(() => {
  const HASH_FORMAT = 'pbkdf2-sha256';
  // 600.000 repetições = recomendação atual da OWASP para PBKDF2-HMAC-SHA256.
  // Senhas antigas (210.000) continuam válidas e são atualizadas no próximo login (needsRehash).
  const ITERATIONS = 600000;
  const MIN_ITERATIONS = 100000;
  const MAX_ITERATIONS = 2000000;
  const encoder = new TextEncoder();

  function toBase64(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function fromBase64(value) {
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  }

  async function derive(password, salt, iterations) {
    const key = await globalThis.crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await globalThis.crypto.subtle.deriveBits({
      name: 'PBKDF2', salt, iterations, hash: 'SHA-256'
    }, key, 256);
    return new Uint8Array(bits);
  }

  function isHashed(storedValue) {
    return typeof storedValue === 'string' && storedValue.startsWith(`${HASH_FORMAT}$`);
  }

  // true quando a senha está em texto puro ou com menos repetições que o padrão atual.
  function needsRehash(storedValue) {
    if (!isHashed(storedValue)) return true;
    return Number(storedValue.split('$')[1]) < ITERATIONS;
  }

  async function hash(password) {
    if (!globalThis.crypto?.subtle) throw new Error('Web Crypto não está disponível.');
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const derived = await derive(password, salt, ITERATIONS);
    return `${HASH_FORMAT}$${ITERATIONS}$${toBase64(salt)}$${toBase64(derived)}`;
  }

  async function verify(password, storedValue) {
    if (typeof storedValue !== 'string' || !storedValue) return false;
    if (!isHashed(storedValue)) return password === storedValue;
    if (!globalThis.crypto?.subtle) throw new Error('Web Crypto não está disponível.');

    const [, iterationsText, saltText, expectedText] = storedValue.split('$');
    const iterations = Number(iterationsText);
    if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) return false;

    try {
      const salt = fromBase64(saltText);
      const expected = fromBase64(expectedText);
      if (salt.length !== 16 || expected.length !== 32) return false;

      const actual = await derive(password, salt, iterations);
      let difference = 0;
      for (let index = 0; index < actual.length; index++) difference |= actual[index] ^ expected[index];
      return difference === 0;
    } catch {
      return false;
    }
  }

  window.TechSaudePassword = { hash, verify, isHashed, needsRehash };
})();