import { describe, it, expect } from "vitest";
import { parsePncpClipboardText, parseBrazilianDateToISO } from "./pncpParser";
import { isValidCPF, isValidCNPJ, formatCPF, formatCNPJ } from "./validation";

describe("PNCP Parser Utility", () => {
  describe("parseBrazilianDateToISO", () => {
    it("should correctly parse Brazilian DD/MM/YYYY dates with time to Datetime-Local format", () => {
      const result = parseBrazilianDateToISO("25/12/2026 14:30");
      expect(result).toBe("2026-12-25T14:30");
    });

    it("should default time to 09:00 if only DD/MM/YYYY date is supplied", () => {
      const result = parseBrazilianDateToISO("25/12/2026");
      expect(result).toBe("2026-12-25T09:00");
    });

    it("should parse normal ISO standard inputs without modification", () => {
      const result = parseBrazilianDateToISO("2026-12-25T09:00");
      expect(result).toBe("2026-12-25T09:00");
    });
  });

  describe("parsePncpClipboardText", () => {
    it("should handle empty raw clipboard texts gracefully", () => {
      const parsed = parsePncpClipboardText("");
      expect(parsed.edital).toBe("");
      expect(parsed.itens).toEqual([]);
    });

    it("should parse sample PNCP structured fields successfully", () => {
      const mockText = `
        Pregão Eletrônico nº 10/2026
        Órgão: Prefeitura de Salvador
        Unidade compradora: Secretaria de Saúde
        Modalidade da contratação: Pregão Eletrônico
        Local: Salvador/BA
        VALOR TOTAL ESTIMADO DA COMPRA
        500000.00
      `;
      const parsed = parsePncpClipboardText(mockText);
      expect(parsed.edital).toContain("Pregão Eletrônico nº 10/2026");
      expect(parsed.orgao).toBe("Prefeitura de Salvador");
      expect(parsed.modalidade).toBe("Pregão Eletrônico");
      expect(parsed.cidade).toBe("Salvador");
      expect(parsed.estado).toBe("BA");
    });
  });
});

describe("Brazilian CPF & CNPJ Validation Utility", () => {
  describe("isValidCPF", () => {
    it("should reject known invalid or repeating-digit CPFs", () => {
      expect(isValidCPF("11111111111")).toBe(false);
      expect(isValidCPF("123456789")).toBe(false);
    });

    it("should accept historically valid mathematical CPFs", () => {
      // A standard mathematically valid CPF: "12345678909"
      expect(isValidCPF("12345678909")).toBe(true);
    });
  });

  describe("isValidCNPJ", () => {
    it("should reject invalid/repeating CNPJs", () => {
      expect(isValidCNPJ("00000000000000")).toBe(false);
      expect(isValidCNPJ("123456")).toBe(false);
    });

    it("should accept valid standard corporate CNPJs", () => {
      // A mathematically valid CNPJ: "00000000000191"
      expect(isValidCNPJ("00000000000191")).toBe(true);
    });
  });

  describe("formatting", () => {
    it("should format CPF accurately with standard digit masking", () => {
      expect(formatCPF("12345678909")).toBe("123.456.789-09");
    });

    it("should format CNPJ correctly with corporate masking", () => {
      expect(formatCNPJ("00000000000191")).toBe("00.000.000/0001-91");
    });
  });
});
