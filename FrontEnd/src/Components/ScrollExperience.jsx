import { useEffect } from "react";

/** Progreso global y parallax ligero de la landing, sin dependencias externas. */
export default function ScrollExperience() {
    useEffect(() => {
        let frame = 0;
        const update = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const root = document.documentElement;
                const scrollAmount = Math.min(window.scrollY, window.innerHeight);
                root.style.setProperty("--landing-background-shift", `${scrollAmount * 0.16}px`);
                root.style.setProperty("--landing-card-shift", `${scrollAmount * -0.08}px`);
            });
        };
        update();
        window.addEventListener("scroll", update, { passive: true });
        window.addEventListener("resize", update);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("scroll", update);
            window.removeEventListener("resize", update);
            document.documentElement.style.removeProperty("--landing-scroll");
            document.documentElement.style.removeProperty("--landing-background-shift");
            document.documentElement.style.removeProperty("--landing-card-shift");
        };
    }, []);

    return null;
}
