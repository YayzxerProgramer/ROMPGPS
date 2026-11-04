/** Marca de ROMP GPS. Toma el color del texto que la rodea (currentColor). */
export default function LogoRomp({ tamano = 24, className = "" }) {
    return (
        <svg
            className={className}
            width={tamano}
            height={tamano}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ flexShrink: 0 }}
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="12" cy="12" r="7" />
            <path d="M12 1.5V5M12 19v3.5M1.5 12H5M19 12h3.5" />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" stroke="none" />
        </svg>
    );
}
