"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/icon";

function step(direction: 1 | -1) {
  const deck = document.getElementById("deck");
  if (!deck) return;
  const slides = [...deck.querySelectorAll<HTMLElement>(".slide")];
  const current = slides.findIndex((slide) => slide.offsetTop + slide.offsetHeight / 2 > deck.scrollTop + 1);
  slides[Math.min(Math.max(current + direction, 0), slides.length - 1)]?.scrollIntoView({ behavior: "smooth" });
}

export function DeckNav() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement).tagName === "INPUT") return;
      if (["ArrowDown", "ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        step(1);
      } else if (["ArrowUp", "ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        step(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <nav className="deck-nav" aria-label="Navegar nos slides">
      <Link href="/" aria-label="Voltar ao site">
        <Icon name="home" size={18} />
      </Link>
      <button type="button" onClick={() => step(-1)} aria-label="Slide anterior">
        <Icon name="arrowUp" size={18} />
      </button>
      <button type="button" onClick={() => step(1)} aria-label="Slide seguinte">
        <Icon name="arrowDown" size={18} />
      </button>
    </nav>
  );
}
