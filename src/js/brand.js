import { createAboutExperiencePanel } from "./ui/aboutExperiencePanel.js";

/**
 * DOM-only interactions for the cinematic logo in the fixed HUD.
 *
 * The emblem's tiny magnetic response lives here, while the separate About
 * panel module owns its connector, modal lifecycle, focus, and scroll freeze.
 */
const brand = document.querySelector(".brand");

// Guarding the listener makes this module safe on pages that do not render a logo.
if (brand) {
    createAboutExperiencePanel({ trigger: brand });

    brand.addEventListener("mousemove", (e) => {

        const text = brand.querySelector(".brand__text");
        // getBoundingClientRect returns the logo's size and viewport position.
        const rect = brand.getBoundingClientRect();

        // Move the coordinate origin to the center of the logo. Dividing by 18
        // keeps the movement subtle instead of following the pointer pixel-for-pixel.
        const x = (e.clientX - rect.left - rect.width / 2) / 18;
        const y = (e.clientY - rect.top - rect.height / 2) / 18;

        // CSS performs the actual animated movement through its transition rule.
        text.style.transform =
            `translate(${x}px, ${y}px) scale(1.02)`;

    });

    brand.addEventListener("mouseleave", () => {
        // Restore the neutral position when the pointer leaves the logo.
        brand.querySelector(".brand__text").style.transform =
            "translate(0,0) scale(1)";
    });
}
