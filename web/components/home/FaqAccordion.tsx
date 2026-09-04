"use client";

// Accordéon FAQ — porté depuis js/main.js#initFAQ. Un seul volet ouvert à la
// fois (ouvrir un item referme les autres).
import { useState } from "react";
import { Icon } from "@/components/icons/Icon";

export interface FaqItem {
  question: string;
  answer: string;
}

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="faq-list">
      {items.map((item, i) => {
        const open = i === openIndex;
        const qId = `faq-question-${i + 1}`;
        const answerId = `faq-answer-${i + 1}`;
        return (
          <div className={"faq-item" + (open ? " open" : "")} key={i}>
            <button
              className="faq-question"
              type="button"
              id={qId}
              aria-expanded={open}
              aria-controls={answerId}
              onClick={() => setOpenIndex(open ? -1 : i)}
            >
              {item.question}
              <span className="chev">
                <Icon name="expand" size="lg" />
              </span>
            </button>
            <div
              className="faq-answer"
              id={answerId}
              role="region"
              aria-labelledby={qId}
              aria-hidden={!open}
              inert={!open}
            >
              <p>{item.answer}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
