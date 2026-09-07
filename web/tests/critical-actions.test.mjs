import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const clone = (value) => (value === undefined ? undefined : structuredClone(value));

function makeDb(initial) {
  const rows = new Map(Object.entries(initial).map(([key, value]) => [key, clone(value)]));
  let counter = 0;
  let queue = Promise.resolve();
  const apply = (kind, ref, value) => {
    if (kind === "set") rows.set(ref.path, clone(value));
    else rows.set(ref.path, { ...clone(rows.get(ref.path)), ...clone(value) });
  };
  const document = (documentPath) => ({
    path: documentPath,
    id: documentPath.split("/").at(-1),
    get() {
      const value = clone(rows.get(this.path));
      return Promise.resolve({ id: this.id, ref: this, exists: value !== undefined, data: () => clone(value) });
    },
    set(value) { apply("set", this, value); return Promise.resolve(); },
    update(value) { apply("update", this, value); return Promise.resolve(); },
    collection(name) { return collection(`${this.path}/${name}`); },
  });
  function collection(collectionPath, filters = [], maximum = Infinity, order = null) {
    return {
      path: collectionPath,
      doc(id = `test-${++counter}`) { return document(`${collectionPath}/${id}`); },
      add(value) { const ref = this.doc(); return ref.set(value).then(() => ref); },
      where(field, operator, expected) {
        assert.equal(operator, "==");
        return collection(collectionPath, [...filters, [field, expected]], maximum, order);
      },
      limit(value) { return collection(collectionPath, filters, value, order); },
      orderBy(field, direction = "asc") { return collection(collectionPath, filters, maximum, [field, direction]); },
      async get() {
        let docs = [...rows.entries()]
          .filter(([key]) => key.startsWith(`${collectionPath}/`) && !key.slice(collectionPath.length + 1).includes("/"))
          .map(([key]) => document(key))
          .map(async (ref) => ref.get());
        docs = await Promise.all(docs);
        docs = docs.filter((doc) => filters.every(([field, expected]) => doc.data()?.[field] === expected));
        if (order) docs.sort((a, b) => String(a.data()?.[order[0]]).localeCompare(String(b.data()?.[order[0]])) * (order[1] === "desc" ? -1 : 1));
        docs = docs.slice(0, maximum);
        return { docs, size: docs.length, empty: docs.length === 0 };
      },
    };
  }
  const db = { rows, collection };
  db.runTransaction = (callback) => {
    const run = queue.then(async () => {
      const writes = [];
      const tx = {
        get: (ref) => ref.get(),
        set: (ref, value) => writes.push(["set", ref, clone(value)]),
        update: (ref, value) => writes.push(["update", ref, clone(value)]),
      };
      const result = await callback(tx);
      writes.forEach((write) => apply(...write));
      return result;
    });
    queue = run.catch(() => {});
    return run;
  };
  db.batch = () => {
    const writes = [];
    return {
      update: (ref, value) => writes.push(["update", ref, clone(value)]),
      commit: async () => writes.forEach((write) => apply(...write)),
    };
  };
  return db;
}

function fixture(extra = {}) {
  const db = makeDb({
    "customers/client-test": { name: "Client test", phone: "237600000000" },
    "products/maillot-test": { name: "Maillot test", price: 12000, stock: 10, sizes: ["M", "L"] },
    ...extra,
  });
  const state = { adminChecks: 0, customerChecks: 0, collectCalls: [] };
  const modules = new Map();
  const mocks = {
    "server-only": {},
    react: { cache: (fn) => fn },
    "next/cache": { revalidatePath: () => {} },
    "next/headers": {},
    "@/lib/firebase/admin": { adminDb: db },
    "@/lib/auth/dal": {
      verifyAdminSession: async () => { state.adminChecks++; return { uid: "admin-test" }; },
      verifyCustomerSession: async () => { state.customerChecks++; return { uid: "client-test" }; },
    },
    "@/lib/cloudinary": { signUpload: () => { throw new Error("hors périmètre"); } },
  };

  function load(relative) {
    const absolute = path.join(root, relative);
    if (modules.has(absolute)) return modules.get(absolute).exports;
    const testModule = { exports: {} };
    modules.set(absolute, testModule);
    const source = fs.readFileSync(absolute, "utf8");
    const output = ts.transpileModule(source, {
      fileName: absolute,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const customRequire = (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name.startsWith("@/")) return load(`${name.slice(2)}.ts`);
      if (name.startsWith("node:")) return require(name);
      throw new Error(`Dépendance non simulée : ${name}`);
    };
    vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: absolute })(customRequire, testModule, testModule.exports);
    return testModule.exports;
  }
  return { db, load, mocks, state };
}

const item = (qty, size = "M") => ({ slug: "maillot-test", size, qty });
const orderRows = (fixtureValue) => [...fixtureValue.db.rows.entries()].filter(([key]) => /^orders\/[^/]+$/.test(key));

test("commande WhatsApp : refuse une quantité négative sans toucher au stock", async () => {
  const f = fixture();
  const result = await f.load("lib/actions/orders.ts").createCustomerOrderAction({ items: [item(-5, "X")], requestId: "request-negative-0001" });
  assert.equal(result.ok, false);
  assert.equal(f.db.rows.get("products/maillot-test").stock, 10);
  assert.equal(orderRows(f).length, 0);
});

test("commande WhatsApp : total serveur, cumul des tailles et réessai idempotent", async () => {
  const f = fixture();
  const action = f.load("lib/actions/orders.ts").createCustomerOrderAction;
  const input = { items: [item(2, "M"), item(3, "L")], requestId: "request-idempotent-0001", total: 1 };
  const [first, retry] = await Promise.all([action(input), action(input)]);
  assert.equal(first.ok && retry.ok, true);
  assert.equal(first.id, retry.id);
  assert.equal(f.db.rows.get("products/maillot-test").stock, 5);
  assert.equal(orderRows(f).length, 1);
  assert.equal(orderRows(f)[0][1].total, 60000);
});

test("paiement : succès, échec tardif et répétition ne décomptent qu'une fois", async () => {
  const f = fixture({
    "products/maillot-test": { name: "Maillot test", price: 12000, stock: 8, sizes: ["M"] },
    "orders/payment": { items: [item(2)], paymentStatus: "pending", stockState: "reserved", paidAt: null },
  });
  const apply = f.load("lib/paymentHelpers.ts").applyPaymentResult;
  await apply("payment", "SUCCESSFUL", null);
  await apply("payment", "FAILED", "tardif");
  await apply("payment", "SUCCESSFUL", null);
  assert.equal(f.db.rows.get("products/maillot-test").stock, 8);
  assert.equal(f.db.rows.get("orders/payment").paymentStatus, "paid");
});

test("paiement : un échec libère une réservation exactement une fois", async () => {
  const f = fixture({
    "products/maillot-test": { name: "Maillot test", price: 12000, stock: 8, sizes: ["M"] },
    "orders/payment": { items: [item(2)], paymentStatus: "pending", stockState: "reserved", paidAt: null },
  });
  const apply = f.load("lib/paymentHelpers.ts").applyPaymentResult;
  await apply("payment", "FAILED", "refusé");
  await apply("payment", "FAILED", "répété");
  assert.equal(f.db.rows.get("products/maillot-test").stock, 10);
  assert.equal(f.db.rows.get("orders/payment").stockState, "released");
});

test("paiement : réservation atomique empêche deux ventes du dernier article", async () => {
  const f = fixture({ "products/maillot-test": { name: "Maillot test", price: 12000, stock: 1, sizes: ["M"] } });
  f.mocks["@/lib/campay"] = {
    campayCollect: async (input) => { f.state.collectCalls.push(input); return { reference: `provider-${f.state.collectCalls.length}`, ussd_code: "*126#", operator: "TEST" }; },
    campayGetTransaction: async () => { throw new Error("non utilisé"); },
    campayTransactionMismatch: () => null,
  };
  const action = f.load("lib/actions/payments.ts").initiateCampayPaymentAction;
  const [a, b] = await Promise.all([
    action({ items: [item(1)], requestId: "payment-request-00001" }),
    action({ items: [item(1)], requestId: "payment-request-00002" }),
  ]);
  assert.equal([a.ok, b.ok].filter(Boolean).length, 1);
  assert.equal(f.state.collectCalls.length, 1);
  assert.equal(f.db.rows.get("products/maillot-test").stock, 0);
});

test("couche de données admin : vérifie elle-même la session", async () => {
  const f = fixture({ "orders/private": { createdAt: "2026-01-01" } });
  await f.load("lib/data/orders.ts").getAllOrders();
  assert.equal(f.state.adminChecks, 1);
});

test("webhook : applique uniquement le statut relu auprès de CamPay", async () => {
  const f = fixture({
    "orders/payment": {
      paymentReference: "external-test", campayReference: "provider-test", total: 12000,
      paymentStatus: "pending", stockState: "reserved", items: [item(1)],
    },
  });
  const applied = [];
  f.mocks["@/lib/campay"] = {
    verifyCampayWebhookSignature: () => true,
    campayGetTransaction: async () => ({
      reference: "provider-test", external_reference: "external-test", amount: 12000,
      currency: "XAF", status: "FAILED", reason: "statut fournisseur",
    }),
    campayTransactionMismatch: () => null,
  };
  f.mocks["@/lib/paymentHelpers"] = { applyPaymentResult: async (...args) => applied.push(args) };
  const response = await f.load("app/api/campay/webhook/route.ts").POST(new Request("https://test.invalid/api/campay/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      signature: "validée-par-le-double", endpoint: "collect", external_reference: "external-test",
      status: "SUCCESSFUL", amount: 1, currency: "USD",
    }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(applied[0], ["payment", "FAILED", "statut fournisseur"]);
});

test("livraison : réaffecter révoque l'ancien jeton et le livreur ne reçoit pas le jeton d'avis", async () => {
  const f = fixture({
    "couriers/new": { active: true },
    "orders/delivery": {
      status: "confirmee", assignedCourierId: "old", courierLocationToken: "old-token",
      courierLocationSharing: true, courierLiveLocation: null, locationToken: "customer-token",
    },
  });
  const courierActions = f.load("lib/actions/couriers.ts");
  assert.equal((await courierActions.assignCourierToOrderAction("delivery", "new")).ok, true);
  assert.notEqual(f.db.rows.get("orders/delivery").courierLocationToken, "old-token");
  assert.equal((await f.load("lib/actions/orders.ts").getOrderForLocationAction("old-token")).ok, false);

  const currentToken = f.db.rows.get("orders/delivery").courierLocationToken;
  f.db.rows.set("orders/delivery", {
    ...f.db.rows.get("orders/delivery"), status: "livree", reviewToken: "customer-review", reviewSubmitted: false,
  });
  const shared = await f.load("lib/actions/orders.ts").getSharedLocationViewAction(currentToken);
  assert.equal(shared.ok, true);
  assert.equal(shared.reviewToken, null);
});

test("livraison : cinq codes erronés verrouillent temporairement la confirmation", async () => {
  const f = fixture({
    "orders/delivery-code": {
      status: "confirmee", courierLocationToken: "courier-token", deliveryCode: "1234",
      deliveryCodeAttempts: 0, reviewToken: null, deliveredAt: null,
    },
  });
  const action = f.load("lib/actions/orders.ts").markOrderDeliveredByCourierAction;
  for (let attempt = 0; attempt < 5; attempt++) {
    const result = await action("courier-token", "9999");
    assert.equal(result.ok, false);
  }
  const row = f.db.rows.get("orders/delivery-code");
  assert.ok(row.deliveryCodeLockedUntil);
  assert.equal((await action("courier-token", "1234")).ok, false);
  assert.equal(f.db.rows.get("orders/delivery-code").status, "confirmee");
});
