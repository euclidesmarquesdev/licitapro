// Professional input sanitization module for LicitaPro
export function sanitizeInput(text: string): string {
  if (!text) return "";
  
  let sanitized = text;

  // 1. Recursive removal of script and style tags and tag bodies to completely prevent execution
  sanitized = sanitized.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");
  sanitized = sanitized.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "");

  // 2. Strip standard framing & layout tags that can hold injections (iframe, object, embed, form, meta, link, svgs)
  sanitized = sanitized.replace(/<(iframe|object|embed|applet|meta|link|form|svg|math)[^>]*>([\s\S]*?)<\/\1>/gi, "");

  // 3. Purge inline event handlers (like onload, onerror, onclick, onmouseover etc.)
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*(['"])(.*?)\1/gi, "");
  sanitized = sanitized.replace(/\son[a-z]+\s*=\s*([^>'\s"]+)/gi, "");

  // 4. Invalidate javascript / active protocol URI schemes
  sanitized = sanitized.replace(/javascript:/gi, "[PROTOCOLO INVALIDADO]");
  sanitized = sanitized.replace(/data:text\/html/gi, "[PROTOCOLO INVALIDADO]");
  sanitized = sanitized.replace(/vbscript:/gi, "[PROTOCOLO INVALIDADO]");

  // 5. Strip any generic residual HTML bracket elements to produce clean plain-text output
  sanitized = sanitized.replace(/<\/?[a-z][^>]*>/gi, "");
  
  // 6. Eradicate adversarial instructions to override or manipulate system prompt boundaries
  const injectionPatterns = [
    /ignore as instruções anteriores/gi,
    /ignore as diretrizes anterior/gi,
    /ignore tudo o que foi duto/gi,
    /desconsidere as instruções/gi,
    /ignore previous instructions/gi,
    /system instructions/gi,
    /you are now/gi,
    /você agora é/gi,
    /agora você deve/gi,
    /ignore restrictions/gi,
    /force response/gi
  ];
  
  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[CONTEÚDO REMOVIDO POR PREVENÇÃO DE PROMPT INJECTION]");
  }
  return sanitized;
}
