import puppeteer from "puppeteer";
import sdk from "@1password/sdk";
import { TOTP } from "totp-generator";
import fs from "fs";
import {
  getPhoneNumber,
  getCountryCode,
  getDepartmentCode,
} from "./helpers.ts";

type ActivityCorrespondenceTable = {
  [key: string]: {
    id?: string;
    label?: string;
    checked?: boolean;
  }[];
};

const CONFIG_FILE = process.env.CONFIG_FILE || "";

const OP_SERVICE_ACCOUNT_TOKEN = process.env.OP_SERVICE_ACCOUNT_TOKEN || "";
const OP_USER_REF = "op://register-sidecar/CRF/username";
const OP_PASS_REF = "op://register-sidecar/CRF/password";
const OP_TOTP_REF = "op://register-sidecar/CRF/one-time password";

const OP_CLIENT = await sdk.createClient({
  auth: OP_SERVICE_ACCOUNT_TOKEN,
  integrationName: "register-sidecar",
  integrationVersion: "1.0.0",
});

const GAIA_URL = "https://gaia.croix-rouge.fr/crf-benevoles/";
const INSEE_URL = "https://geo.api.gouv.fr/";

const ACTIVITY_CORRESPONDENCE_TABLE: ActivityCorrespondenceTable = {
  "Accompagnement scolaire": [
    {
      id: "act9",
      label: "Apprentissage des savoirs",
      checked: true,
    },
  ],
  "Action culturelle": [
    {
      id: "act95",
      label: "Acc\u00e8s \u00e0 la culture et aux loisirs",
      checked: true,
    },
  ],
  "Aide aux personnes agées": [
    {
      id: "act28",
      label: "Actions aupr\u00e8s des personnes \u00e2g\u00e9es",
      checked: true,
    },
  ],
  Communication: [
    {
      id: "act46",
      label: "D\u00e9veloppement associatif",
      checked: true,
    },
  ],
  "DIH (Droit International Humanitaire)": [
    {
      id: "act93",
      label: "Droit international humanitaire",
      checked: true,
    },
  ],
  "Épicerie solidaire": [
    {
      id: "act99",
      label: "Aide Alimentaire",
      checked: true,
    },
  ],
  "FLE (Français Langue Étrangère)": [
    {
      id: "act9",
      label: "Apprentissage des savoirs",
      checked: true,
    },
  ],
  "Inclusion numérique": [
    {
      id: "act100",
      label: "Inclusion num\u00e9rique",
      checked: true,
    },
  ],
  Maraudes: [
    {
      id: "act6",
      label: "Samu Social, maraudes, \u00e9quipes mob. - Op\u00e9rations",
      checked: true,
    },
  ],
  "PAEO (Permanence d'Accueil d'Écoute et d'Orientation)": [
    {
      id: "act39",
      label: "Accueil et orientation",
      checked: true,
    },
  ],
  "RLF (Rétablissement des Liens Familiaux)": [
    {
      id: "act75",
      label: "Action de r\u00e9tablissement des liens familiaux",
      checked: true,
    },
  ],
  "Urgence et Secourisme": [
    {
      id: "act74",
      label: "Corps de R\u00e9serve de l'Urgence",
      checked: true,
    },
    {
      id: "act19",
      label: "Postes de secours",
      checked: true,
    },
    {
      id: "act65",
      label: "R\u00e9seau de secours",
      checked: true,
    },
    {
      id: "act21",
      label: "Urgence et autres op\u00e9rations",
      checked: true,
    },
  ],
};

/**
 * Saves the provided cookies to a JSON file.
 * @param cookies - The cookies to save.
 */
const saveCookiesToJsonFile = (cookies: any[]) => {
  const content = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  content.cookies = Object.fromEntries(
    cookies.map((cookie) => [cookie.name, cookie.value]),
  );
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(content), "utf-8");
};

/**
 * Retrieves the Gaia cookies from the JSON file.
 * @returns An array of cookies with their names and values.
 */
const getGaiaCookiesFromJsonFile = (): any[] => {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")).cookies || [];
  } catch (error) {
    console.error("Error reading cookies from JSON file: ", error);
    return [];
  }
};

/**
 * Simulates a login flow to Okta using Puppeteer and retrieves the session cookies for Gaia.
 * @async
 * @returns The session cookies.
 */
const getGaiaCookiesFromPuppeteer = async () => {
  // Get the username, password, and TOTP secret from 1Password
  const username = await OP_CLIENT.secrets.resolve(OP_USER_REF);
  const password = await OP_CLIENT.secrets.resolve(OP_PASS_REF);
  const totpSecret = new URL(
    await OP_CLIENT.secrets.resolve(OP_TOTP_REF),
  ).searchParams.get("secret");

  // Launching Puppeteer browser

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  // Browsing to Okta login page and performing the login flow

  try {
    console.log("Browsing to Okta login page...");
    await page.goto("https://connect.croix-rouge.fr", {
      waitUntil: "networkidle2",
    });

    // Username
    await page.waitForSelector('input[name="identifier"]', { visible: true });
    await page.type('input[name="identifier"]', username);

    // Password
    await page.type('input[name="credentials.passcode"]', password);

    // Remember me
    await page.click('div[class="custom-checkbox"]');

    // Submit
    await page.click('input[type="submit"]');
  } catch (error) {
    console.error("Error during initial login: ", error);
    await browser.close();
    throw error;
  }

  // First authentication step successful, now handling TOTP provider selection if required

  console.log("First auth successful.");

  try {
    console.log("Checking for TOTP provider selection step...");
    await page.waitForSelector(
      "::-p-aria(Sélectionnez Google Authenticator.)",
      {
        visible: true,
        timeout: 5000,
      },
    );
    await page.click("::-p-aria(Sélectionnez Google Authenticator.)");
  } catch {
    console.log("TOTP provider selection not required.");
  }

  // Now handling the TOTP input step

  try {
    await page.waitForSelector('input[name="credentials.passcode"]', {
      visible: true,
      timeout: 5000,
    });

    const { otp } = await TOTP.generate(totpSecret ? totpSecret : "", {
      period: 30,
      digits: 6,
    });

    await page.type('input[name="credentials.passcode"]', otp);
    await page.click('input[type="submit"]');
  } catch (error) {
    console.error("Error during TOTP input: ", error);
    await browser.close();
    throw error;
  }

  // Wait for navigation to complete after submitting the OTP
  await page.waitForNavigation({ waitUntil: "networkidle2" });

  console.log("Auth successfull. Browsing to Gaia page to extract cookies...");

  console.log("Browsing to Gaia page...");
  await page.goto("https://gaia.croix-rouge.fr", {
    waitUntil: "networkidle2",
  });

  // Extract cookies
  const cookies = await browser.cookies();
  await browser.close();

  const gaiaCookies = cookies.filter(
    (cookie) =>
      cookie.domain.includes("gaia.croix-rouge.fr") &&
      Array.from(cookie.name)[0] !== "_",
  );

  return gaiaCookies;
};

/**
 * Registers a user on Gaia.
 * @param userData The user data to register.
 * @async
 * @returns A boolean that indicates whether the user was successfully registered or not.
 */
export const registerUser = async (userData: any) => {
  // Get the Gaia cookies from the JSON file
  let data = getGaiaCookiesFromJsonFile();
  let cookiesString = Object.entries(data)
    .map(
      ([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`,
    )
    .join("; ");

  // We need to check if the user is already logged in by making a request to Gaia with the cookies.
  // The request does not follow redirects, so if the response is 302, it means the user is not logged (and is redirected to Okta auth) in and needs to log in.
  const request = await fetch(GAIA_URL, {
    method: "GET",
    headers: {
      Cookie: cookiesString,
    },
    redirect: "manual",
  });

  if (request.status === 302) {
    // The user is not logged in, so we need to log in and get the cookies from Puppeteer.

    console.log(
      "User is not logged in. Logging in with Puppeteer to get cookies.",
    );

    const newCookies = await getGaiaCookiesFromPuppeteer();
    saveCookiesToJsonFile(newCookies);

    data = getGaiaCookiesFromJsonFile();
    cookiesString = Object.entries(data)
      .map(
        ([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`,
      )
      .join("; ");
  }

  // ------- The user is logged in, so we can now make the request to register the user with the cookies. -------

  // Get the actions tree based on the user's activity and second activity
  const actionsTree: ActivityCorrespondenceTable[string] =
    ACTIVITY_CORRESPONDENCE_TABLE[userData.activity] || [];

  if (userData.second_activity) {
    actionsTree.push(
      ...(ACTIVITY_CORRESPONDENCE_TABLE[userData.second_activity] || []),
    );
  }

  // Set the phone number based on the user's country using libphonenumber-js
  const benevolePhone = getPhoneNumber(
    userData.benevole_country,
    userData.benevole_phone,
  );
  const sosPhone = getPhoneNumber(userData.sos_country, userData.sos_phone);

  // Get INSEE code based on the user's postal code
  const inseeRequest = await fetch(
    INSEE_URL +
      "communes?codePostal=" +
      encodeURIComponent(userData.benevole_postal_code).substring(0, 5) +
      "&fields=code",
    {
      method: "GET",
    },
  );

  const inseeData = (await inseeRequest.json()) as {
    code: string;
    nom: string;
  }[];

  // Get INSEE code based on the user's birth location postal code
  const birthPostalCode =
    getDepartmentCode(userData.benevole_birth_departement) === "2A" ||
    getDepartmentCode(userData.benevole_birth_departement) === "2B"
      ? "20000"
      : getDepartmentCode(userData.benevole_birth_departement) +
        (getDepartmentCode(userData.benevole_birth_departement).length === 2
          ? "000"
          : "00");

  const inseeRequestBirth = await fetch(
    INSEE_URL +
      "communes?codePostal=" +
      encodeURIComponent(birthPostalCode).substring(0, 5) +
      "&fields=code",
    {
      method: "GET",
    },
  );

  const inseeDataBirth = (await inseeRequestBirth.json()) as {
    code: string;
    nom: string;
  }[];

  // Set the data to post to Gaia for user registration
  const postData = {
    actionsTree: actionsTree,
    contactCreation: {
      dateEntree: new Date().toISOString().split("T")[0] + "T00:00:00.000Z",
      strId: 903,

      civCd: userData.benevole_civilite,
      nomNaissance: userData.benevole_name,
      nomUsage: userData.benevole_name_usage,
      prenom: userData.benevole_surname,
      dateNaissance: userData.benevole_birth_date,
      villeNaissance: userData.benevole_birth_city,
      codeDepartementNaissance: getDepartmentCode(
        userData.benevole_birth_departement,
      ),
      codePostalNaissance: birthPostalCode,
      codeInseeNaissance: inseeDataBirth[0]?.code || "75056",
      departementNaissance: userData.benevole_birth_departement,
      paysNaissanceCode: getCountryCode(userData.benevole_birth_country),
      paysNaissance: userData.benevole_birth_country,
      numVoie: userData.benevole_address1,
      compltAdresse: userData.benevole_address2,
      codePostal: userData.benevole_postal_code,
      codeInsee: inseeData[0]?.code || "75056",
      ville: userData.benevole_city,
      pays: userData.benevole_country,
      codePays: getCountryCode(userData.benevole_country),

      email: userData.benevole_email,
      tymCodeEmail: "PER",
      codCodeTelephone: benevolePhone.codeTelephone,
      telephone: benevolePhone.phoneNumber,
      tymCodeTelephone: "PER",

      pacCivCd: userData.sos_civilite,
      pacNom: userData.sos_name,
      pacPrenom: userData.sos_surname,
      pacNumeroVoie: userData.sos_address1,
      pacComplementAdresse: userData.sos_address2,
      pacCodePostal: userData.sos_postal_code,
      pacVille: userData.sos_city,
      pacPaysCode: getCountryCode(userData.sos_country),
      pacParId: userData.sos_relation,

      pacEmail: userData.sos_email,
      pacCodCodeTelephone: sosPhone.codeTelephone,
      pacTelephone: sosPhone.phoneNumber,
    },
  };

  // Make the POST request to Gaia to register the user
  const postContactRequest = await fetch(GAIA_URL + "contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookiesString,
    },
    body: JSON.stringify(postData),
  });

  const responseData = (await postContactRequest.json()) as {
    [key: string]: any;
  };

  console.log("Response from Gaia");
  console.dir(responseData, { depth: null, colors: true });

  // Check the response status and log the result
  if (postContactRequest.status === 200) {
    console.log("User registered successfully.");

    return {
      success: true,
      nivol: responseData.cobIdnivol,
    };
  } else {
    console.error(
      `Failed to register user. Status: ${postContactRequest.status}`,
    );

    return {
      success: false,
      nivol: "",
    };
  }
};
