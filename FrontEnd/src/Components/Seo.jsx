import { useEffect } from "react";

/**
 * Componente SEO para gestión dinámica de títulos, descripciones,
 * URL canónicas, tarjetas Open Graph y directivas de robots en SPA.
 */
export default function Seo({
    title,
    description,
    canonical,
    noIndex = false,
    ogType = "website",
    ogImage = "https://rompgps.com/og-image.png",
}) {
    useEffect(() => {
        // Actualizar el título de la pestaña del navegador
        if (title) {
            document.title = title;
        }

        // Utilidad interna para crear o actualizar etiquetas <meta>
        const setMeta = (selector, attribute, value) => {
            let tag = document.querySelector(selector);
            if (!tag) {
                tag = document.createElement("meta");
                const [attrName, attrVal] = selector.replace(/[\[\]"]/g, "").split("=");
                tag.setAttribute(attrName, attrVal);
                document.head.appendChild(tag);
            }
            tag.setAttribute(attribute, value);
        };

        // Metas primarias y Open Graph de descripción
        if (description) {
            setMeta('meta[name="description"]', "content", description);
            setMeta('meta[property="og:description"]', "content", description);
            setMeta('meta[name="twitter:description"]', "content", description);
        }

        // Metas de título para redes sociales
        if (title) {
            setMeta('meta[name="title"]', "content", title);
            setMeta('meta[property="og:title"]', "content", title);
            setMeta('meta[name="twitter:title"]', "content", title);
        }

        // Metas de imagen compartida
        if (ogImage) {
            setMeta('meta[property="og:image"]', "content", ogImage);
            setMeta('meta[property="og:image:secure_url"]', "content", ogImage);
            setMeta('meta[name="twitter:image"]', "content", ogImage);
        }

        // Tipo de recurso Open Graph
        if (ogType) {
            setMeta('meta[property="og:type"]', "content", ogType);
        }

        // Enlace canónico y URL Open Graph
        if (canonical) {
            let linkCanonical = document.querySelector('link[rel="canonical"]');
            if (!linkCanonical) {
                linkCanonical = document.createElement("link");
                linkCanonical.setAttribute("rel", "canonical");
                document.head.appendChild(linkCanonical);
            }
            linkCanonical.setAttribute("href", canonical);
            setMeta('meta[property="og:url"]', "content", canonical);
        }

        // Control de indexación para páginas privadas o administrativas
        if (noIndex) {
            setMeta('meta[name="robots"]', "content", "noindex, nofollow");
            setMeta('meta[name="googlebot"]', "content", "noindex, nofollow");
            setMeta('meta[name="bingbot"]', "content", "noindex, nofollow");
        } else {
            setMeta(
                'meta[name="robots"]',
                "content",
                "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
            );
            setMeta(
                'meta[name="googlebot"]',
                "content",
                "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1"
            );
            setMeta(
                'meta[name="bingbot"]',
                "content",
                "index, follow, max-snippet:-1, max-image-preview:large"
            );
        }
    }, [title, description, canonical, noIndex, ogType, ogImage]);

    return null;
}
