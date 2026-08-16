import express from "express";
import { PDFTextField, PDFCheckBox, PDFForm } from "pdf-lib";
import type { CorrespondenceTable, ComputedValues } from "./app.ts";

const API_KEY = process.env.API_KEY || "";

export const apiKeyAuth = (req: express.Request) => {
  const provided = req.header("x-api-key") || "";
  return provided === API_KEY;
};

export const replacePlaceholders = (
  template: string,
  replacements: Record<string, string>,
) => {
  let result = template;

  for (const [placeholder, value] of Object.entries(replacements)) {
    const regex = new RegExp(`{{${placeholder}}}`, "g");
    result = result.replace(regex, value);
  }
  return result;
};

export const fillForm = (
  form: PDFForm,
  correspondenceTable: CorrespondenceTable,
  answers: Record<string, string>,
  computed: ComputedValues,
) => {
  form.getFields().forEach((field) => {
    const name = field.getName();
    const correspondence = correspondenceTable[name];

    if (correspondence) {
      let value: string | boolean | undefined;
      switch (correspondence.type) {
        case "var":
          value =
            correspondence.var === undefined
              ? undefined
              : answers[correspondence.var];
          break;
        case "hardcoded":
          value = correspondence.value;
          break;
        case "equals":
          value =
            correspondence.var !== undefined &&
            answers[correspondence.var] === correspondence.value;
          break;
        case "computed":
          value =
            correspondence.var === undefined
              ? undefined
              : computed[correspondence.var];
          break;
      }

      if (value !== undefined && typeof value === "string") {
        (field as PDFTextField).setText(value);
      } else if (value !== undefined && typeof value === "boolean") {
        if (value) {
          (field as PDFCheckBox).check();
        }
      }
    }
  });
};
