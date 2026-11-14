import { useEffect, useRef } from "react";

/** Revela cada sección al entrar en pantalla y la oculta al salir para
 * mantener una sensación de profundidad durante todo el recorrido. */
export default function ScrollReveal({ children }) {
    const ref = useRef(null);

    useEffect(() => {
        const element = ref.current;
        if (!element || !("IntersectionObserver" in window)) return;

        element.classList.add("scroll-reveal-ready");
        const observer = new IntersectionObserver(([entry]) => {
            element.classList.toggle("scroll-reveal-visible", entry.isIntersecting);
        }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    return <div className="scroll-reveal" ref={ref}>{children}</div>;
}
