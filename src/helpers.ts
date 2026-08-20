import {
  PDFTextField,
  PDFCheckBox,
  PDFForm,
  drawCheckBox,
  rgb,
} from "@cantoo/pdf-lib";
import type { CorrespondenceTable, ComputedValues } from "./app.ts";
import crypto from "crypto";

/**
 * Fills a PDF form with the provided answers and computed values based on the correspondence table.
 *
 * @param form The PDF form to fill.
 * @param correspondenceTable The table mapping form fields to answer keys or computed values.
 * @param answers The user's answers.
 * @param computed The computed values.
 */
export const fillForm = (
  form: PDFForm,
  correspondenceTable: CorrespondenceTable,
  answers: Record<string, string>,
  computed: ComputedValues,
) => {
  // Get all fields in the form and iterate over them
  form.getFields().forEach((field) => {
    const name = field.getName();
    const correspondence = correspondenceTable[name];

    if (correspondence) {
      let value: string | boolean | undefined;

      switch (correspondence.type) {
        // Value is a variable from the answers object
        case "var":
          value =
            correspondence.var === undefined
              ? undefined
              : answers[correspondence.var];
          break;

        // Value is a hardcoded string
        case "hardcoded":
          value = correspondence.value;
          break;

        // Value is determined by checking if the answer matches a specific value
        case "equals":
          value =
            correspondence.var !== undefined &&
            answers[correspondence.var] === correspondence.value;
          break;

        // Value is computed based on the computed values object
        case "computed":
          value =
            correspondence.var === undefined
              ? undefined
              : computed[correspondence.var];
          break;
      }

      // Set value in the form field based on its type
      if (value !== undefined && typeof value === "string") {
        (field as PDFTextField).setText(value);
      } else if (value !== undefined && typeof value === "boolean") {
        if (value) {
          (field as PDFCheckBox).check();
        } else {
          (field as PDFCheckBox).uncheck();
        }

        // Trick to force the checkbox to update its appearance after being checked and PDF flatten.
        if ((field as PDFCheckBox).isChecked()) {
          (field as PDFCheckBox).updateAppearances(() => {
            return {
              normal: {
                on: drawCheckBox({
                  color: rgb(0, 0, 0.5),
                  filled: true,
                  x: 0 + 1,
                  y: 0 + 1,
                  width: 20,
                  height: 20,
                  thickness: 1.5,
                  borderWidth: 2,
                  markColor: rgb(0, 0, 0.5),
                  borderColor: rgb(0, 0, 0.5),
                }),
                off: drawCheckBox({
                  color: rgb(0, 0, 0.5),
                  filled: true,
                  x: 0 + 1,
                  y: 0 + 1,
                  width: 20,
                  height: 20,
                  thickness: 1.5,
                  borderWidth: 2,
                  markColor: rgb(0, 0, 0.5),
                  borderColor: rgb(0, 0, 0.5),
                }),
              },
            };
          });
        }
      }
    }
  });
};

/**
 * Verifies the webhook signature by comparing the received secret with the expected secret using a constant-time comparison to prevent timing attacks.
 *
 * @param receivedSecret The secret received from the webhook request.
 * @param expectedSecret The expected secret configured in the application.
 * @returns A boolean indicating whether the received secret matches the expected secret.
 */
export const verifySecret = (
  receivedSecret: string,
  expectedSecret: string,
) => {
  if (!receivedSecret) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSecret),
      Buffer.from(expectedSecret),
    );
  } catch {
    return false;
  }
};
