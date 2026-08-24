import {
  PDFTextField,
  PDFCheckBox,
  PDFForm,
  drawCheckBox,
  rgb,
} from "@cantoo/pdf-lib";
import type { CorrespondenceTable, ComputedValues } from "./app.ts";
import crypto from "crypto";
import { parsePhoneNumber } from "libphonenumber-js";
import fs from "fs";

const CONFIG_FILE = process.env.CONFIG_FILE || "";

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

/**
 * Returns the parsed phone number and the corresponding telephone code for a given country.
 *
 * @param country The country name to determine the telephone code.
 * @param phone The phone number string to parse.
 * @returns An object containing the parsed phone number and the telephone code.
 */
export const getPhoneNumber = (country: string, phone: string) => {
  let phoneNumber = null;
  let codeTelephone = null;

  switch (country) {
    case "FRANCE":
      phoneNumber = parsePhoneNumber(phone, "FR");
      codeTelephone = "I33";
      break;

    case "BELGIQUE":
      phoneNumber = parsePhoneNumber(phone, "BE");
      codeTelephone = "I32";
      break;

    case "ESPAGNE":
      phoneNumber = parsePhoneNumber(phone, "ES");
      codeTelephone = "I34";
      break;

    case "ITALIE":
      phoneNumber = parsePhoneNumber(phone, "IT");
      codeTelephone = "I39";
      break;

    case "SUISSE":
      phoneNumber = parsePhoneNumber(phone, "CH");
      codeTelephone = "I41";
      break;

    case "ROYAUME-UNI":
      phoneNumber = parsePhoneNumber(phone, "GB");
      codeTelephone = "I44";
      break;

    case "ALLEMAGNE":
      phoneNumber = parsePhoneNumber(phone, "DE");
      codeTelephone = "I49";
      break;

    case "ZAMBIE":
      phoneNumber = parsePhoneNumber(phone, "ZM");
      codeTelephone = "I260";
      break;

    case "MAYOTTE":
      phoneNumber = parsePhoneNumber(phone, "YT");
      codeTelephone = "I262";
      break;

    case "LA REUNION":
      phoneNumber = parsePhoneNumber(phone, "RE");
      codeTelephone = "I262";
      break;

    case "COMORES":
      phoneNumber = parsePhoneNumber(phone, "KM");
      codeTelephone = "I269";
      break;

    case "LUXEMBOURG":
      phoneNumber = parsePhoneNumber(phone, "LU");
      codeTelephone = "I352";
      break;

    case "ANDORRE":
      phoneNumber = parsePhoneNumber(phone, "AD");
      codeTelephone = "I376";
      break;

    case "SAINT-PERRE-ET-MIQUELON":
      phoneNumber = parsePhoneNumber(phone, "PM");
      codeTelephone = "I508";
      break;

    case "GUADELOUPE":
      phoneNumber = parsePhoneNumber(phone, "GP");
      codeTelephone = "I590";
      break;

    case "MARTINIQUE":
      phoneNumber = parsePhoneNumber(phone, "MQ");
      codeTelephone = "I596";
      break;

    case "WALLIS-ET-FUTUNA":
      phoneNumber = parsePhoneNumber(phone, "WF");
      codeTelephone = "I681";
      break;

    case "NOUVELLE-CALEDONIE":
      phoneNumber = parsePhoneNumber(phone, "NC");
      codeTelephone = "I687";
      break;

    case "POLYNESIE FRANCAISE":
      phoneNumber = parsePhoneNumber(phone, "PF");
      codeTelephone = "I689";
      break;

    default:
      phoneNumber = parsePhoneNumber(phone, "FR");
      codeTelephone = "I33";
      break;
  }

  if (!phoneNumber) {
    phoneNumber = parsePhoneNumber(phone, "FR");
    codeTelephone = "I33";
  }

  if (!phoneNumber) {
    phoneNumber = parsePhoneNumber("0601000001", "FR");
    codeTelephone = "I33";
  }

  return {
    phoneNumber: phoneNumber.formatInternational().slice(codeTelephone?.length),
    codeTelephone,
  };
};

/**
 * Retrieves the country code for a given country name from the configuration file.
 *
 * @param country The name of the country
 * @returns The country code if found, otherwise null
 */
export const getCountryCode = (country: string) => {
  const countries = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")).countries;
  const countryData = countries.find(
    (c: { name: string }) => c.name === country,
  );
  return countryData ? countryData.code : null;
};

/**
 * Retrieves the department code for a given department name from the configuration file.
 *
 * @param department The name of the department
 * @returns The department code if found, otherwise null
 */
export const getDepartmentCode = (department: string) => {
  const departements = JSON.parse(
    fs.readFileSync(CONFIG_FILE, "utf-8"),
  ).departements;
  const departmentData = departements.find(
    (d: { nom: string }) => d.nom === department,
  );
  return departmentData ? departmentData.code : null;
};
