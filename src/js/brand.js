const brand = document.querySelector(".brand");

if (brand) {
    brand.addEventListener("mousemove", (e) => {

        const text = brand.querySelector(".brand__text");

        const rect = brand.getBoundingClientRect();

        const x = (e.clientX - rect.left - rect.width / 2) / 18;
        const y = (e.clientY - rect.top - rect.height / 2) / 18;

        text.style.transform =
            `translate(${x}px, ${y}px) scale(1.02)`;

    });

    brand.addEventListener("mouseleave", () => {

        brand.querySelector(".brand__text").style.transform =
            "translate(0,0) scale(1)";
    });
}