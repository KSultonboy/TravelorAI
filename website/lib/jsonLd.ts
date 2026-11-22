/**
 * JSON-LD'ni <script type="application/ld+json"> ichiga XAVFSIZ joylash.
 *
 * Oddiy JSON.stringify `</script>` ni escape qilmaydi — agentlik tur nomiga
 * `</script><script>...` yozsa, u sahifada bajarilib ketardi (stored XSS).
 * Shu sababli `<`, `>`, `&` va U+2028/U+2029 unicode-escape qilinadi; JSON
 * ma'nosi o'zgarmaydi, qidiruv tizimlari baribir to'g'ri o'qiydi.
 */
export function jsonLdScript(value: unknown): { __html: string } {
  const json = JSON.stringify(value) ?? "null";
  return {
    __html: json
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029"),
  };
}
