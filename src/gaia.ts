import puppeteer from "puppeteer";
import sdk from "@1password/sdk";
import { TOTP } from "totp-generator";
import { getPhoneNumber, getCountryCode, formatString } from "./helpers.ts";

type ActivityCorrespondenceTable = {
  [key: string]: string[];
};

const OP_SERVICE_ACCOUNT_TOKEN = process.env.OP_SERVICE_ACCOUNT_TOKEN || "";
const OP_USER_REF = "op://register-sidecar/CRF/username";
const OP_PASS_REF = "op://register-sidecar/CRF/password";
const OP_TOTP_REF = "op://register-sidecar/CRF/one-time password";

const OP_CLIENT = await sdk.createClient({
  auth: OP_SERVICE_ACCOUNT_TOKEN,
  integrationName: "register-sidecar",
  integrationVersion: "1.0.0",
});

const ACTIVITY_CORRESPONDENCE_TABLE: ActivityCorrespondenceTable = {
  "Accompagnement scolaire": ["Apprentissage des savoirs"],
  "Action culturelle": ["Accès à la culture et aux loisirs"],
  "Aide aux personnes agées": ["Actions auprès des personnes âgées"],
  Communication: ["Développement associatif"],
  "DIH (Droit International Humanitaire)": ["Droit international humanitaire"],
  "Épicerie solidaire": ["Aide Alimentaire"],
  "FLE (Français Langue Étrangère)": ["Apprentissage des savoirs"],
  "Inclusion numérique": ["Inclusion numérique"],
  Maraudes: ["Samu Social, maraudes, équipes mob. - Opérations"],
  "PAEO (Permanence d'Accueil d'Écoute et d'Orientation)": [
    "Accueil et orientation",
  ],
  "RLF (Rétablissement des Liens Familiaux)": [
    "Action de rétablissement des liens familiaux",
  ],
  "Urgence et Secourisme": ["Urgence et Secourisme"],
};

/**
 * Simulates a login flow to Okta and fill the registration form on Gaia using Puppeteer.
 * @async
 * @param userData The data of the user to register on Gaia.
 * @param birthDate The birth date of the benevole.
 * @param benevolePhone The phone details of the benevole.
 * @param sosPhone The phone details of the SOS contact.
 * @param actions The list of actions the benevole is interested in.
 * @returns The result of the registration process.
 */
const registerBenevoleOnGaia = async (
  userData: any,
  birthDate: string,
  benevolePhone: any,
  sosPhone: any,
  actions: string[],
) => {
  // Get the username, password, and TOTP secret from 1Password
  const username = await OP_CLIENT.secrets.resolve(OP_USER_REF);
  const password = await OP_CLIENT.secrets.resolve(OP_PASS_REF);
  const totpSecret = new URL(
    await OP_CLIENT.secrets.resolve(OP_TOTP_REF),
  ).searchParams.get("secret");

  // Launching Puppeteer browser

  const browser = await puppeteer.launch(
    process.env.GIT_TAG
      ? {
          headless: true,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
          ],
          executablePath: "/usr/bin/google-chrome-stable",
        }
      : {
          headless: false,
        },
  );
  const page = await browser.newPage();
  page.setDefaultTimeout(2500);

  // Browsing to Okta login page and performing the login flow

  // ---------------------------- OKTA LOGIN ----------------------------

  try {
    console.log("Browsing to Okta login page...");
    await page.goto("https://connect.croix-rouge.fr", {
      waitUntil: "networkidle2",
      timeout: 10000,
    });

    // Username
    await page.locator('input[name="identifier"]').fill(username);

    // Password
    await page.locator('input[name="credentials.passcode"]').fill(password);

    // Remember me
    await page.locator('div[class="custom-checkbox"]').click();

    // Submit
    await page.locator('input[type="submit"]').click();

    // First authentication step successful, now handling TOTP provider selection if required

    console.log("First auth successful.");

    console.log("Checking for TOTP provider selection step...");
    await page.locator("::-p-aria(Sélectionnez Google Authenticator.)").click();

    // Now handling the TOTP input step

    const { otp } = await TOTP.generate(totpSecret ? totpSecret : "", {
      period: 30,
      digits: 6,
    });

    await page.locator('input[name="credentials.passcode"]').fill(otp);
    await page.locator('input[type="submit"]').click();

    // Wait for navigation to complete after submitting the OTP
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 });

    console.log("Auth successfull. Browsing to Gaia...");

    console.log("Browsing to Gaia page...");
    await page.goto("https://gaia.croix-rouge.fr/crf-benevoles/#", {
      waitUntil: "networkidle2",
      timeout: 10000,
    });

    // Click on Benevole button
    await page.locator("::-p-aria(BÉNÉVOLE)").click();

    // ---------------------------- FORM : PAGE 1 ----------------------------

    console.log("Filling page 1...");

    // Fill identity
    await page
      .locator('select[name="contactCreation.civCd"]')
      .fill(userData.benevole_civilite);

    // Fill Prenom
    await page
      .locator('input[id="contactCreation.prenom"]')
      .fill(userData.benevole_surname);

    // Fill Nom de naissance
    await page
      .locator('input[id="contactCreation.nomNaissance"]')
      .fill(userData.benevole_name);

    // Fill Nom d'Usage
    if (userData.benevole_name_usage !== null) {
      await page
        .locator('input[id="contactCreation.nomUsage"]')
        .fill(userData.benevole_name_usage);
    }

    // Fill Date de naissance
    await page
      .locator('input[id="contactCreation.dateNaissance"]')
      .fill(birthDate);

    // Click to close the date picker if it's open
    await page.click("body");

    // Fill Pays de naissance
    await page
      .locator('select[name="contactCreation.paysNaissanceCode"]')
      .fill(getCountryCode(userData.benevole_birth_country));

    // Fill Département de naissance and Ville de naissance

    if (userData.benevole_birth_country === "FRANCE") {
      // If France, fill the department of birth using the awesomplete input and click on the first suggestion. Then do the same for the city.

      if (userData.benevole_birth_department !== null) {
        await page
          .locator('xpath/(//div[contains(@class, "awesomplete")])[1]//input')
          .fill(userData.benevole_birth_departement);
      }

      await page
        .locator('xpath/(//div[contains(@class, "awesomplete")])[1]//ul//li[1]')
        .click();

      await page
        .locator('xpath/(//div[contains(@class, "awesomplete")])[2]//input')
        .fill(userData.benevole_birth_city);

      await page
        .locator(
          `xpath/((//div[contains(@class, "awesomplete")])[2]//ul//li//mark[contains(text(), "${formatString(userData.benevole_birth_city)}")])[1]`,
        )
        .click();
    } else {
      // If not France, fill the city of birth directly.
      await page
        .locator('input[id="contactCreation.villeNaissanceLabel"]')
        .fill(userData.benevole_birth_city);
    }

    // First page done, proceed to the next step of the registration process.
    await page.locator("::-p-aria(CONTINUER)").click();

    // ---------------------------- FORM : PAGE 2 ----------------------------

    console.log("Filling page 2...");

    // Fill Numéro et voie
    await page
      .locator('input[id="contactCreation.numVoie"]')
      .fill(userData.benevole_address1);

    // Fill Complément d'adresse
    if (userData.benevole_address2 !== null) {
      await page
        .locator('input[id="contactCreation.compltAdresse"]')
        .fill(userData.benevole_address2);
    }

    // Fill Pays
    await page
      .locator('select[name="contactCreation.codePays"]')
      .fill(getCountryCode(userData.benevole_country));

    // Fill Code postal and Ville
    if (userData.benevole_country === "FRANCE") {
      // If France, fill the postal code using the awesomplete input
      await page
        .locator('xpath/(//div[contains(@class, "awesomplete")])[1]//input')
        .fill(userData.benevole_postal_code);

      // Click on the correct city
      await page
        .locator(
          `xpath/((//div[contains(@class, "awesomplete")])[1]//ul//li[contains(text(), "${formatString(userData.benevole_city)}")])[1]`,
        )
        .click();
    } else {
      // Fill Postal code
      await page
        .locator('input[id="contactCreation.codePostal"]')
        .fill(userData.benevole_postal_code);

      // Fill City
      await page
        .locator('input[id="contactCreation.villeLabel"]')
        .fill(userData.benevole_city);
    }

    // Fill Telephone
    await page
      .locator('select[name="contactCreation.tymCodeTelephone"]')
      .fill("PER");

    await page
      .locator('select[name="contactCreation.codCodeTelephone"]')
      .fill(benevolePhone.codeTelephone);

    await page
      .locator('input[id="contactCreation.telephone"]')
      .fill(benevolePhone.phoneNumber.replace(/\s/g, ""));

    // Fill email address
    await page
      .locator('select[name="contactCreation.tymCodeEmail"]')
      .fill("PER");

    await page
      .locator('input[id="contactCreation.email"]')
      .fill(userData.benevole_email);

    // Second page done, proceed to the next step of the registration process.
    await page.locator("::-p-aria(CONTINUER)").click();

    // ---------------------------- FORM : PAGE 3 ----------------------------

    console.log("Filling page 3...");

    // Fill Civilité
    await page
      .locator('select[name="contactCreation.pacCivCd"]')
      .fill(userData.sos_civilite);

    // Fill Prénom
    await page
      .locator('input[id="contactCreation.pacPrenom"]')
      .fill(userData.sos_surname);

    // Fill Nom
    await page
      .locator('input[id="contactCreation.pacNom"]')
      .fill(userData.sos_name);

    // Fill Lien avec la personne
    await page
      .locator('select[name="contactCreation.pacParId"]')
      .fill(userData.sos_relation.toString());

    // Fill Numéro et voie
    if (userData.sos_address1 !== null) {
      await page
        .locator('input[id="contactCreation.pacNumeroVoie"]')
        .fill(userData.sos_address1);
    }

    // Fill Complément d'adresse
    if (userData.sos_address2 !== null) {
      await page
        .locator('input[id="contactCreation.pacComplementAdresse"]')
        .fill(userData.sos_address2);
    }

    // Fill Pays
    await page
      .locator('select[name="contactCreation.pacCodePays"]')
      .fill(getCountryCode(userData.sos_country));

    // Fill Code postal and Ville
    if (userData.sos_country === "FRANCE") {
      // If France, fill the postal code using the awesomplete input
      await page
        .locator('xpath/(//div[contains(@class, "awesomplete")])[1]//input')
        .fill(userData.sos_postal_code);

      // Click on the correct city
      await page
        .locator(
          `xpath/((//div[contains(@class, "awesomplete")])[1]//ul//li[contains(text(), "${formatString(userData.sos_city)}")])[1]`,
        )
        .click();
    } else {
      // Fill Postal code
      await page
        .locator('input[id="contactCreation.pacCodePostal"]')
        .fill(userData.sos_postal_code);

      // Fill City
      await page
        .locator('input[id="contactCreation.pacVille"]')
        .fill(userData.sos_city);
    }

    // Fill Telephone
    await page
      .locator('select[name="contactCreation.pacCodCodeTelephone"]')
      .fill(sosPhone.codeTelephone);

    await page
      .locator('input[id="contactCreation.pacTelephone"]')
      .fill(sosPhone.phoneNumber.replace(/\s/g, ""));

    // Fill Email
    if (userData.sos_email !== null) {
      await page
        .locator('input[id="contactCreation.pacEmail"]')
        .fill(userData.sos_email);
    }

    // Third page done, proceed to the next step of the registration process.
    await page.locator("::-p-aria(CONTINUER)").click();

    // ---------------------------- FORM : PAGE 4 ----------------------------

    console.log("Filling page 4...");

    // Check the actions that the user is interested in
    actions.forEach(async (action) => {
      console.log(`Selecting action: ${action}`);
      await page
        .locator(
          `xpath/(//span[contains(text(), "${action}")]/preceding-sibling::div//label//span[contains(@class, "mdl-checkbox__ripple-container")])[1]`,
        )
        .click();
    });

    await new Promise((resolve) => setTimeout(resolve, 2500)); // Wait for 2.5 seconds to ensure all actions are selected before proceeding

    console.log("Form finished, submitting...");

    // Fourth page done, proceed to the next step of the registration process.
    await page.locator("::-p-aria(VALIDER)").click();

    // ---------------------------- USER PAGE --------------------------------

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 10000 });

    console.log("Form submitted, extracting NIVOL...");

    await new Promise((resolve) => setTimeout(resolve, 2500)); // Wait for 2.5 seconds to ensure all actions are selected before proceeding

    // Extract NIVOL value
    const nivolHandle = await page
      .locator(
        "xpath/html[@class='mdl-js']/body/div[1]/header/div[2]/div[@class='cartridge-benevole benevole']/span/span[3]",
      )
      .map((element) => element.textContent)
      .wait();
    const nivol = nivolHandle.trim();

    console.log("Success, NIVOL is", nivol);
    browser.close();

    return nivol;
  } catch (error) {
    console.error("Error during Puppeteer execution:", error);
    await browser.close();
    return false;
  }
};

/**
 * Registers a user on Gaia.
 * @param userData The user data to register.
 * @async
 * @returns A boolean that indicates whether the user was successfully registered or not.
 */
export const registerUser = async (userData: any) => {
  // Get the actions tree based on the user's activity and second activity
  const actions = ACTIVITY_CORRESPONDENCE_TABLE[userData.activity] || [];

  if (userData.second_activity) {
    actions.push(
      ...(ACTIVITY_CORRESPONDENCE_TABLE[userData.second_activity] || []),
    );
  }

  // Set the phone numbers based on the user's country using libphonenumber-js
  const benevolePhone = getPhoneNumber(
    userData.benevole_country,
    userData.benevole_phone,
  );
  const sosPhone = getPhoneNumber(userData.sos_country, userData.sos_phone);

  // Format birth date
  const birthDate = new Date(userData.benevole_birth_date).toLocaleDateString(
    "fr-FR",
    {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  );

  // Create the user on Gaia and retrieve the NIVOL number
  const nivol = await registerBenevoleOnGaia(
    userData,
    birthDate,
    benevolePhone,
    sosPhone,
    actions,
  );

  if (!nivol) {
    return {
      success: false,
      nivol: "???",
    };
  } else {
    return {
      success: true,
      nivol: nivol,
    };
  }
};
