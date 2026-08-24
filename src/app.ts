import express from "express";
import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import fs from "fs";
import Database from "better-sqlite3";
import { fillForm, verifySecret } from "./helpers.ts";
import parsePhoneNumber from "libphonenumber-js";

// Types

export type CorrespondenceTable = {
  [key: string]: {
    type: "var" | "hardcoded" | "equals" | "computed";
    var?: string;
    value?: string;
  };
};

export type ComputedValues = {
  [key: string]: string;
};

// Correspondence tables between Google Forms and PDF form

const CORRESPONDENCE_TABLE_AUTORISATION_PARTENTALE: CorrespondenceTable = {
  téléphone: {
    type: "var",
    var: "Téléphone",
  },
  "adresse mail": {
    type: "var",
    var: "Adresse mail",
  },
  "prénom et nom du bénévole mineur": {
    type: "var",
    var: "Agissant en qualité de représentant légal de",
  },
  "activités proposées - 1": {
    type: "computed",
    var: "activity_1_legal_guardian",
  },
  "activités proposées - 2": {
    type: "computed",
    var: "activity_2_legal_guardian",
  },
  "prénom et nom contact d'urgence": {
    type: "computed",
    var: "emergency_contact_name_and_firstname",
  },
  "téléphone contact d'urgence": {
    type: "var",
    var: "Numéro de téléphone",
  },
  "lien parenté contact d'urgence": {
    type: "var",
    var: "Lien avec toi",
  },
  "prénom et nom titulaire autorité parentale": {
    type: "computed",
    var: "legal_guardian_name_and_firstname",
  },
  "adresse complète titulaire autorité parentale": {
    type: "var",
    var: "Demeurant au",
  },
};

const CORRESPONDENCE_TABLE_CHARTE_BENEVOLAT: CorrespondenceTable = {
  Nom: {
    type: "var",
    var: "Ton nom de famille",
  },
  Prénom: {
    type: "var",
    var: "Ton prénom",
  },
  Nom_2: {
    type: "hardcoded",
    value: "LE GRANVALLET",
  },
  Prénom_2: {
    type: "hardcoded",
    value: "Nathan",
  },
  Qualité: {
    type: "hardcoded",
    value: "Président de l'Unité locale de Paris 15",
  },
  "Structure de rattachement 1": {
    type: "hardcoded",
    value: "903",
  },
  "Structure de rattachement 2": {
    type: "hardcoded",
    value: "Unité locale de Paris 15",
  },
  Nom_3: {
    type: "var",
    var: "Nom de famille du titulaire de l'autorité parentale",
  },
  Prénom_3: {
    type: "var",
    var: "Prénom du titulaire de l'autorité parentale",
  },
  "nom / qualité": {
    type: "computed",
    var: "emergency_contact_name_and_quality",
  },
  "numéro de téléphone": {
    type: "var",
    var: "Numéro de téléphone",
  },
};

const CORRESPONDENCE_TABLE_DOSSIER_BENEVOLE: CorrespondenceTable = {
  Nom: {
    type: "var",
    var: "Ton nom de famille",
  },
  Prénom: {
    type: "var",
    var: "Ton prénom",
  },
  "Structure de rattachement": {
    type: "hardcoded",
    value: "Unité locale de Paris 15 (903)",
  },
  "Déjà bénévole - OUI": {
    type: "equals",
    var: "As-tu déjà été bénévole à la Croix-Rouge française ?",
    value: "Oui",
  },
  "Déjà bénévole - NON": {
    type: "equals",
    var: "As-tu déjà été bénévole à la Croix-Rouge française ?",
    value: "Non",
  },
  "NIVOL - Non": {
    type: "equals",
    var: "Connais-tu ton NIVOL ?",
    value: "Non",
  },
  "NIVOL - Oui": {
    type: "equals",
    var: "Connais-tu ton NIVOL ?",
    value: "Oui",
  },
  NIVOL: {
    type: "var",
    var: "Si oui, quel est ton NIVOL ?",
  },
  "Mail CRf - NON": {
    type: "equals",
    var: "As-tu déjà une adresse mail Croix-Rouge ?",
    value: "Non",
  },
  "Mail CRf - OUI": {
    type: "equals",
    var: "As-tu déjà une adresse mail Croix-Rouge ?",
    value: "Oui",
  },
  "Mail CRf": {
    type: "var",
    var: "Si oui, quelle est ton adresse mail Croix-Rouge ?",
  },
  "Civilité - Mme": {
    type: "equals",
    var: "Civilité",
    value: "Madame",
  },
  "Civilité - M": {
    type: "equals",
    var: "Civilité",
    value: "Monsieur",
  },
  "Nom de naissance": {
    type: "var",
    var: "Ton nom de famille",
  },
  "Nom d'usage": {
    type: "var",
    var: "Ton nom d'usage",
  },
  "Prénom - 2": {
    type: "var",
    var: "Ton prénom",
  },
  "Jour naissance": {
    type: "computed",
    var: "day",
  },
  "Mois naissance": {
    type: "computed",
    var: "month",
  },
  "Année naissance": {
    type: "computed",
    var: "year",
  },
  "Ville naissance": {
    type: "var",
    var: "Ton lieu de naissance",
  },
  "Pays naissance": {
    type: "var",
    var: "Ton pays de naissance",
  },
  "Département naissance": {
    type: "var",
    var: "Ton département de naissance (pour la France)",
  },
  "Numéro et voie résidence": {
    type: "var",
    var: "Numéro et voie",
  },
  "Complément adresse résidence": {
    type: "var",
    var: "Complément d'adresse",
  },
  "Code postal et ville résidence": {
    type: "computed",
    var: "postal_code_and_city",
  },
  "Pays résidence": {
    type: "var",
    var: "Pays",
  },
  "Téléphone personnel": {
    type: "var",
    var: "Téléphone personnel",
  },
  "Téléphone professionnel": {
    type: "var",
    var: "Téléphone professionnel",
  },
  "Email personnel": {
    type: "var",
    var: "Email personnel",
  },
  "Email professionnel": {
    type: "var",
    var: "Email professionnel",
  },
  "Civilité urgence - Mme": {
    type: "equals",
    var: "Civilité de ton contact d'urgence",
    value: "Madame",
  },
  "Civilité urgence - M": {
    type: "equals",
    var: "Civilité de ton contact d'urgence",
    value: "Monsieur",
  },
  "Nom urgence": {
    type: "var",
    var: "Nom de famille",
  },
  "Prénom urgence": {
    type: "var",
    var: "Prénom",
  },
  "Lien de parenté urgence": {
    type: "var",
    var: "Lien avec toi",
  },
  "Adresse urgence": {
    type: "var",
    var: "Adresse : Numéro et voie",
  },
  "Code Postal et ville urgence": {
    type: "computed",
    var: "emergency_contact_postal_code_and_city",
  },
  "Pays urgence": {
    type: "var",
    var: "Adresse : Pays",
  },
  "Téléphone 1 urgence": {
    type: "var",
    var: "Numéro de téléphone",
  },
  "Téléphone 2 urgence": {
    type: "var",
    var: "Autre numéro de téléphone",
  },
  "Email urgence": {
    type: "var",
    var: "Email",
  },
  "Activité 1": {
    type: "var",
    var: "Ta future activité principale à l'Unité locale",
  },
  "Activité 2": {
    type: "var",
    var: "Si tu souhaites faire une seconde activité, ça serait",
  },
  "Diplome 1": {
    type: "computed",
    var: "diploma_1",
  },
  "Diplome 2": {
    type: "computed",
    var: "diploma_2",
  },
  "Diplome 3": {
    type: "computed",
    var: "diploma_3",
  },
  "Diplome 4": {
    type: "computed",
    var: "diploma_4",
  },
  "Diplome 5": {
    type: "computed",
    var: "diploma_5",
  },
  "Permis 1": {
    type: "computed",
    var: "driving_licence_1",
  },
  "Permis 2": {
    type: "computed",
    var: "driving_licence_2",
  },
  "Permis 3": {
    type: "computed",
    var: "driving_licence_3",
  },
  "Permis 4": {
    type: "computed",
    var: "driving_licence_4",
  },
  "Prénom et nom du bénévole": {
    type: "computed",
    var: "name_and_firstname",
  },
  "Lieu de naissance du bénévole": {
    type: "var",
    var: "Ton lieu de naissance",
  },
  "Nom et ville de la structure": {
    type: "hardcoded",
    value: "Unité locale de Paris 15 (903)",
  },
};

// Env vars

const API_KEY = process.env.API_KEY || "";
const PORT = process.env.PORT || "";
const DOCUMENSO_API_URL = process.env.DOCUMENSO_API_URL || "";
const DOCUMENSO_API_KEY = process.env.DOCUMENSO_API_KEY || "";
const LOCK_URL = process.env.LOCK_URL || "";
const LOCK_API_KEY = process.env.LOCK_API_KEY || "";
const LOCK_GROUP_ID = process.env.LOCK_GROUP_ID || "";
const LOCK_ID = process.env.LOCK_ID || "";
const DB_PATH = process.env.DB_PATH || "";
const MEDIA_PATH = process.env.MEDIA_PATH || "";
const VERSION = process.env.GIT_TAG || "dev";

// Express configuration

const app = express();
app.disable("x-powered-by");
app.use(express.json());

// DB configuration

const db = new Database(DB_PATH + "db.sqlite");
db.prepare(
  `
  CREATE TABLE IF NOT EXISTS dossiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL,
    benevole_email TEXT NOT NULL,
    benevole_url TEXT NOT NULL,
    benevole_surname TEXT NOT NULL,
    benevole_name TEXT NOT NULL,
    benevole_phone TEXT NOT NULL,
    tuteur_email TEXT,
    tuteur_url TEXT,
    tuteur_name TEXT,
    documenso_id TEXT NOT NULL,
    envelope_item_id TEXT NOT NULL,
    document_signed INTEGER DEFAULT 0,
    activity TEXT NOT NULL
  )
`,
).run();

// ----- New dossier to fill and to send to Documenso -----------------------

app.post("/dossiers", async (req: express.Request, res: express.Response) => {
  console.log("POST /dossiers");

  // Check Authorization and return a 401 if wrong

  if (!verifySecret(req.headers["authorization"] as string, API_KEY)) {
    console.log("Unauthorized");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  // Open PDF templates

  const dossierBenevoleFs = fs.readFileSync(
    MEDIA_PATH + "DossierBenevole_Annexes.pdf",
  );
  const charteBenevolatFs = fs.readFileSync(
    MEDIA_PATH + "CharteDuBenevolat.pdf",
  );
  const autorisationParentaleFs = fs.readFileSync(
    MEDIA_PATH + "AutorisationParentale.pdf",
  );

  // Load PDF templates

  const dossierBenevolePdf = await PDFDocument.load(dossierBenevoleFs);
  const charteBenevolatPdf = await PDFDocument.load(charteBenevolatFs);
  const autorisationParentalePdf = await PDFDocument.load(
    autorisationParentaleFs,
  );

  // Compute needed values

  const birthDate = new Date(req.body["answers"]["Ta date de naissance"]);
  const computed: ComputedValues = {
    day: birthDate.getDate().toString(),
    month: (birthDate.getMonth() + 1).toString(),
    year: birthDate.getFullYear().toString(),
    postal_code_and_city: `${req.body["answers"]["Code postal"]} ${req.body["answers"]["Ville"]}`,
    emergency_contact_name_and_firstname: `${req.body["answers"]["Prénom"]} ${req.body["answers"]["Nom de famille"]}`,
    emergency_contact_postal_code_and_city: `${req.body["answers"]["Adresse : Code postal"]} ${req.body["answers"]["Adresse : Ville"]}`,
    emergency_contact_name_and_quality: `${req.body["answers"]["Prénom"]} ${req.body["answers"]["Nom de famille"]} (${req.body["answers"]["Lien avec toi"]})`,
    legal_guardian_name_and_firstname: `${req.body["answers"]["Prénom du titulaire de l'autorité parentale"]} ${req.body["answers"]["Nom de famille du titulaire de l'autorité parentale"]}`,
    name_and_firstname: `${req.body["answers"]["Ton prénom"]} ${req.body["answers"]["Ton nom de famille"]}`,
    diploma_1: req.body["answers"]["Tes diplômes et certifications"]
      ? req.body["answers"]["Tes diplômes et certifications"][0] || ""
      : "",
    diploma_2: req.body["answers"]["Tes diplômes et certifications"]
      ? req.body["answers"]["Tes diplômes et certifications"][1] || ""
      : "",
    diploma_3: req.body["answers"]["Tes diplômes et certifications"]
      ? req.body["answers"]["Tes diplômes et certifications"][2] || ""
      : "",
    diploma_4: req.body["answers"]["Tes diplômes et certifications"]
      ? req.body["answers"]["Tes diplômes et certifications"][3] || ""
      : "",
    diploma_5: req.body["answers"]["Tes diplômes et certifications"]
      ? req.body["answers"]["Tes diplômes et certifications"][4] || ""
      : "",
    driving_licence_1: req.body["answers"]["Tes permis de conduire"]
      ? req.body["answers"]["Tes permis de conduire"][0] || ""
      : "",
    driving_licence_2: req.body["answers"]["Tes permis de conduire"]
      ? req.body["answers"]["Tes permis de conduire"][1] || ""
      : "",
    driving_licence_3: req.body["answers"]["Tes permis de conduire"]
      ? req.body["answers"]["Tes permis de conduire"][2] || ""
      : "",
    driving_licence_4: req.body["answers"]["Tes permis de conduire"]
      ? req.body["answers"]["Tes permis de conduire"][3] || ""
      : "",
    driving_licence_5: req.body["answers"]["Tes permis de conduire"]
      ? req.body["answers"]["Tes permis de conduire"][4] || ""
      : "",
    activity_1_legal_guardian: req.body["answers"][
      "Déclare l'autoriser à participer aux activités ci-dessous organisées par la Croix-Rouge française, telles qu'elles m'ont été exposées"
    ]
      ? req.body["answers"][
          "Déclare l'autoriser à participer aux activités ci-dessous organisées par la Croix-Rouge française, telles qu'elles m'ont été exposées"
        ][0] || ""
      : "",
    activity_2_legal_guardian: req.body["answers"][
      "Déclare l'autoriser à participer aux activités ci-dessous organisées par la Croix-Rouge française, telles qu'elles m'ont été exposées"
    ]
      ? req.body["answers"][
          "Déclare l'autoriser à participer aux activités ci-dessous organisées par la Croix-Rouge française, telles qu'elles m'ont été exposées"
        ][1] || ""
      : "",
  };

  // Prepare final document

  const finalPdf = await PDFDocument.create();
  const pdfsToMerge: Array<PDFDocument> = [];

  // Fill : DOSSIER BENEVOLE

  const dossierBenevoleForm = dossierBenevolePdf.getForm();

  fillForm(
    dossierBenevoleForm,
    CORRESPONDENCE_TABLE_DOSSIER_BENEVOLE,
    req.body["answers"],
    computed,
  );

  const helvetica = await dossierBenevolePdf.embedFont(StandardFonts.Helvetica);
  const secondLastPage =
    dossierBenevolePdf.getPages()[dossierBenevolePdf.getPageCount() - 2];

  secondLastPage?.drawText(
    computed["day"] === undefined ? "" : computed["day"],
    {
      x: 240,
      y: 663,
      size: 10,
      font: helvetica,
    },
  );
  secondLastPage?.drawText(
    computed["month"] === undefined ? "" : computed["month"],
    {
      x: 280,
      y: 663,
      size: 10,
      font: helvetica,
    },
  );
  secondLastPage?.drawText(
    computed["year"] === undefined ? "" : computed["year"],
    {
      x: 310,
      y: 663,
      size: 10,
      font: helvetica,
    },
  );

  dossierBenevoleForm.flatten();
  pdfsToMerge.push(dossierBenevolePdf);

  // Fill : CHARTE BENEVOLE

  const charteBenevolatForm = charteBenevolatPdf.getForm();

  fillForm(
    charteBenevolatForm,
    CORRESPONDENCE_TABLE_CHARTE_BENEVOLAT,
    req.body["answers"],
    computed,
  );

  charteBenevolatForm.flatten();
  pdfsToMerge.push(charteBenevolatPdf);

  // Check if AUTORISATION PARENTALE is needed

  if (req.body["answers"]["Es-tu un mineur de moins de 16 ans ?"] === "Oui") {
    // Fill : AUTORISATION PARENTALE

    const autorisationParentaleForm = autorisationParentalePdf.getForm();

    fillForm(
      autorisationParentaleForm,
      CORRESPONDENCE_TABLE_AUTORISATION_PARTENTALE,
      req.body["answers"],
      computed,
    );

    // Strike relevant parts of PDF

    if (
      req.body["answers"][
        "J'autorise le bénévole mineur à quitter seul le lieu de réalisation de l'activité"
      ] === "Oui"
    ) {
      autorisationParentalePdf.getPage(0).drawLine({
        start: { x: 138, y: 371 },
        end: { x: 200, y: 371 },
        thickness: 2,
      });
    } else {
      autorisationParentalePdf.getPage(0).drawLine({
        start: { x: 94, y: 371 },
        end: { x: 130, y: 371 },
        thickness: 2,
        opacity: 1,
      });
    }

    if (
      req.body["answers"][
        "J'autorise un bénévole régulier de la Croix-Rouge française à raccompagner le bénévole mineur au domicile à l'issue de l'activité"
      ] === "Oui"
    ) {
      autorisationParentalePdf.getPage(0).drawLine({
        start: { x: 138, y: 344 },
        end: { x: 200, y: 344 },
        thickness: 2,
      });
    } else {
      autorisationParentalePdf.getPage(0).drawLine({
        start: { x: 94, y: 344 },
        end: { x: 130, y: 344 },
        thickness: 2,
        opacity: 1,
      });
    }

    autorisationParentaleForm.flatten();

    pdfsToMerge.push(autorisationParentalePdf);
  }

  // Merge all documents in one

  for (const pdf of pdfsToMerge) {
    const pageIndices = pdf.getPageIndices();
    const copiedPages = await finalPdf.copyPages(pdf, pageIndices);
    copiedPages.forEach((page) => finalPdf.addPage(page));
  }

  // Save document

  const pdfFinalBytes = await finalPdf.save();

  // Prepare request to Documenso

  const formData = new FormData();
  const recipients = [
    {
      email: req.body["answers"]["Email personnel"],
      name: computed["name_and_firstname"],
      role: "SIGNER",
      sendEmail: false,
      fields: [
        {
          identifier: 0,
          type: "DATE",
          page: 2,
          positionX: 13,
          positionY: 88,
          width: 18,
          height: 3,
        },
        {
          identifier: 0,
          type: "SIGNATURE",
          page: 2,
          positionX: 42,
          positionY: 88,
          width: 20,
          height: 7,
        },
        {
          identifier: 0,
          type: "DATE",
          page: 5,
          positionX: 14,
          positionY: 85,
          width: 18,
          height: 3,
        },
        {
          identifier: 0,
          type: "SIGNATURE",
          page: 5,
          positionX: 19,
          positionY: 88,
          width: 25,
          height: 8,
        },
        {
          identifier: 0,
          type: "TEXT",
          page: 9,
          positionX: 14,
          positionY: 15,
          width: 30,
          height: 2,
          fieldMeta: {
            type: "text",
            label: "Ville",
            placeholder: "La ville où vous vous trouvez actuellement",
            required: true,
          },
        },
        {
          identifier: 0,
          type: "DATE",
          page: 9,
          positionX: 12,
          positionY: 17,
          width: 10,
          height: 2,
        },
        {
          identifier: 0,
          type: "SIGNATURE",
          page: 9,
          positionX: 12,
          positionY: 38,
          width: 25,
          height: 8,
        },
      ],
    },
  ];

  if (req.body["answers"]["Es-tu un mineur de moins de 16 ans ?"] === "Oui") {
    recipients.push({
      email: req.body["answers"]["Adresse mail"],
      name: computed["legal_guardian_name_and_firstname"],
      role: "SIGNER",
      sendEmail: false,
      fields: [
        {
          identifier: 0,
          type: "SIGNATURE",
          page: 9,
          positionX: 62,
          positionY: 44,
          width: 25,
          height: 8,
        },
        {
          identifier: 0,
          type: "TEXT",
          page: 11,
          positionX: 14,
          positionY: 86,
          width: 25,
          height: 3,
          fieldMeta: {
            type: "text",
            label: "Ville",
            placeholder: "La ville où vous vous trouvez actuellement",
            required: true,
          },
        },
        {
          identifier: 0,
          type: "DATE",
          page: 11,
          positionX: 47,
          positionY: 86,
          width: 25,
          height: 3,
        },
        {
          identifier: 0,
          type: "SIGNATURE",
          page: 11,
          positionX: 45,
          positionY: 90,
          width: 25,
          height: 7,
        },
      ],
    });
  }

  const payload = {
    type: "DOCUMENT",
    title: "Dossier bénévole de " + computed["name_and_firstname"],
    externalId: "DossierBenevole_" + req.body["code"],
    visibility: "EVERYONE",
    recipients: recipients,
    meta: {
      subject:
        "Croix-Rouge française de Paris 15 - Signer votre dossier bénévole",
      message: "Bonjour, merci de relire et de signer le document.",
      redirectUrl: "https://dossier.crf.tools/thanks",
      distributionMethod: "NONE",
    },
  };

  formData.append("payload", JSON.stringify(payload));
  formData.append(
    "files",
    new File(
      [new Blob([new Uint8Array(pdfFinalBytes)], { type: "application/pdf" })],
      `DossierBenevole_${req.body["code"]}.pdf`,
      {
        type: "application/pdf",
      },
    ),
  );

  // Send the document to Documenso

  const response = await fetch(DOCUMENSO_API_URL + "envelope/create", {
    method: "POST",
    headers: {
      Authorization: DOCUMENSO_API_KEY,
    },
    body: formData,
  });

  if (response.status >= 200 && response.status < 400) {
    const { id } = (await response.json()) as { id: string };

    // Get the envelope item ID from Documenso

    const responseEnvelope = await fetch(DOCUMENSO_API_URL + "envelope/" + id, {
      method: "GET",
      headers: {
        Authorization: DOCUMENSO_API_KEY,
      },
    });

    const jsonReponse = (await responseEnvelope.json()) as {
      envelopeItems: Array<{ id: string }>;
    };
    const envelopeItemId = jsonReponse?.envelopeItems?.[0]?.id;

    if (responseEnvelope.status >= 200 && responseEnvelope.status < 400) {
      // Set the document to be signed

      const secondResponse = await fetch(
        DOCUMENSO_API_URL + "envelope/distribute",
        {
          method: "POST",
          headers: {
            Authorization: DOCUMENSO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            envelopeId: id,
          }),
        },
      );

      if (secondResponse.status >= 200 && secondResponse.status < 400) {
        // Get the signing URLs for each recipient

        const { recipients } = (await secondResponse.json()) as {
          recipients: Array<{ email: string; signingUrl: string }>;
        };

        const insert = db.prepare(
          "INSERT INTO dossiers (code, benevole_email, benevole_url, benevole_surname, benevole_name, benevole_phone, tuteur_email, tuteur_url, tuteur_name, document_signed, documenso_id, envelope_item_id, activity) VALUES (@code, @benevole_email, @benevole_url, @benevole_surname, @benevole_name, @benevole_phone, @tuteur_email, @tuteur_url, @tuteur_name, 0, @documenso_id, @envelope_item_id, @activity)",
        );

        if (
          req.body["answers"]["Email personnel"] ===
          req.body["answers"]["Adresse mail"]
        ) {
          insert.run({
            code: req.body["code"],
            benevole_email: req.body["answers"]["Email personnel"],
            benevole_url: recipients[0]?.signingUrl
              ? recipients[0].signingUrl
              : "",
            benevole_surname: req.body["answers"]["Ton prénom"],
            benevole_name: req.body["answers"]["Ton nom de famille"],
            benevole_phone: req.body["answers"]["Téléphone personnel"],
            tuteur_email: req.body["answers"]["Adresse mail"]
              ? req.body["answers"]["Adresse mail"]
              : null,
            tuteur_url: recipients[1]?.signingUrl
              ? recipients[1].signingUrl
              : null,
            tuteur_name:
              req.body["answers"][
                "Nom de famille du titulaire de l'autorité parentale"
              ] || null,
            documenso_id: id,
            envelope_item_id: envelopeItemId,
            activity:
              req.body["answers"][
                "Ta future activité principale à l'Unité locale"
              ],
          });
        } else {
          insert.run({
            code: req.body["code"],
            benevole_email: req.body["answers"]["Email personnel"],
            benevole_url:
              recipients.find(
                (r) => r.email === req.body["answers"]["Email personnel"],
              )?.signingUrl || "",
            benevole_surname: req.body["answers"]["Ton prénom"],
            benevole_name: req.body["answers"]["Ton nom de famille"],
            benevole_phone: req.body["answers"]["Téléphone personnel"],
            tuteur_email: req.body["answers"]["Adresse mail"]
              ? req.body["answers"]["Adresse mail"]
              : null,
            tuteur_url:
              recipients.find(
                (r) => r.email === req.body["answers"]["Adresse mail"],
              )?.signingUrl || null,
            tuteur_name:
              req.body["answers"][
                "Nom de famille du titulaire de l'autorité parentale"
              ] || null,
            documenso_id: id,
            envelope_item_id: envelopeItemId,
            activity:
              req.body["answers"][
                "Ta future activité principale à l'Unité locale"
              ],
          });
        }

        res.status(200).send("OK");
      } else {
        res.status(400).send("KO");
      }
    } else {
      res.status(400).send("KO");
    }
  } else {
    res.status(400).send("KO");
  }
});

// ----- Send data to send mails to sign ------------------------------------

app.get("/dossiers/:code", (req: express.Request, res: express.Response) => {
  console.log("GET /dossiers/" + req.params.code);

  // Check Authorization and return a 401 if wrong

  if (!verifySecret(req.headers["authorization"] as string, API_KEY)) {
    console.log("Unauthorized");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (!req.params.code) {
    res.status(400).json({ message: "Missing code" });
    return;
  }

  const select = db.prepare(
    "SELECT * FROM dossiers WHERE code = ? ORDER BY id DESC LIMIT 1",
  );
  const dossier = select.get(req.params.code);

  if (!dossier) {
    res.status(404).json({ message: "Dossier not found" });
    return;
  }

  res.status(200).json(dossier);
});

// ----- Delete PDFs and data of a dossier ----------------------------------
// This is used when a PDF is signed and the data is imported.
// We also want to add the benevole phone number to lock.crf.tools.

app.delete(
  "/dossiers/:code",
  async (req: express.Request, res: express.Response) => {
    console.log("DELETE /dossiers/" + req.params.code);

    // Check Authorization and return a 401 if wrong

    if (!verifySecret(req.headers["authorization"] as string, API_KEY)) {
      console.log("Unauthorized");
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!req.params.code) {
      console.log("Missing code");
      res.status(400).json({ message: "Missing code" });
      return;
    }

    // Get data

    const select = db.prepare(
      "SELECT * FROM dossiers WHERE code = ? ORDER BY id DESC LIMIT 1",
    );
    const dossier = select.get(req.params.code);

    if (!dossier) {
      console.log("Dossier not found");
      res.status(404).json({ message: "Dossier not found" });
      return;
    }

    if (dossier.document_signed === 1) {
      // Trying to parse phone number
      const phoneNumber = parsePhoneNumber(dossier.benevole_phone, "FR");
      let lockSuccess = false;

      if (phoneNumber) {
        // Add user to lock.crf.tools

        const formDataLockResponse = new FormData();
        formDataLockResponse.append(
          "name",
          dossier.benevole_surname + " " + dossier.benevole_name,
        );
        formDataLockResponse.append("groupId", LOCK_GROUP_ID);
        formDataLockResponse.append("phoneNumber", phoneNumber.number);

        const lockResponse = await fetch(LOCK_URL + "api/users", {
          method: "POST",
          headers: {
            "x-auth-bypass": LOCK_API_KEY,
          },
          body: formDataLockResponse,
        });

        if (lockResponse.status === 201) {
          // Give user access to the lock

          const lockResponseJson = (await lockResponse.json()) as {
            [key: string]: any;
          };

          const formDataLockAccess = new FormData();
          formDataLockAccess.append("userId", lockResponseJson?.user?.id);
          formDataLockAccess.append("lockId", LOCK_ID);

          const lockAccessResponse = await fetch(
            LOCK_URL + "api/authorizations",
            {
              method: "POST",
              headers: {
                "x-auth-bypass": LOCK_API_KEY,
              },
              body: formDataLockAccess,
            },
          );

          if (lockAccessResponse.status === 201) {
            console.log("User added to lock.crf.tools and access granted");
            lockSuccess = true;
          } else {
            console.log("Failed to grant access to lock.crf.tools");
          }
        } else {
          console.log("Failed to add user to lock.crf.tools");
        }
      } else {
        console.log("Failed to parse phone number");
      }

      // TODO : Create the benevole in Gaia

      // Remove from Documenso

      const response = await fetch(DOCUMENSO_API_URL + "envelope/delete", {
        method: "POST",
        headers: {
          Authorization: DOCUMENSO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          envelopeId: dossier.documenso_id,
        }),
      });

      if (response.status < 200 || response.status >= 400) {
        console.log("Failed to delete from Documenso");
        res.status(400).json({ message: "Failed to delete from Documenso" });
        return;
      }

      // Remove from DB

      const del = db.prepare("DELETE FROM dossiers WHERE code = ?");
      del.run(req.params.code);

      if (lockSuccess) {
        res.status(200).send({
          message: "Dossier deleted",
          errorCode: 0,
          benevole: dossier,
          nivol: "???", // TODO : Get the NIVOL from Gaia
        });
      } else {
        res.status(200).send({
          message: "Dossier deleted, but failed to add user to lock.crf.tools",
          errorCode: 1,
          benevole: dossier,
          nivol: "???", // TODO : Get the NIVOL from Gaia
        });
      }
    } else {
      console.log("Dossier not signed, removing because timeout reached");

      // Remove from Documenso

      const response = await fetch(DOCUMENSO_API_URL + "envelope/delete", {
        method: "POST",
        headers: {
          Authorization: DOCUMENSO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          envelopeId: dossier.documenso_id,
        }),
      });

      if (response.status < 200 || response.status >= 400) {
        console.log("Failed to delete from Documenso");
        res.status(400).json({ message: "Failed to delete from Documenso" });
        return;
      } else {
        res.status(200).json({ message: "Dossier deleted" });
      }
    }
  },
);

// ----- Mark a PDF as signed -----------------------------------------------

app.post("/webhook", (req: express.Request, res: express.Response) => {
  console.log("POST /webhook");

  // Check Authorization and return a 401 if wrong

  if (!verifySecret(req.headers["x-documenso-secret"] as string, API_KEY)) {
    console.log("Unauthorized");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  if (req.body["event"] === "DOCUMENT_COMPLETED") {
    if (!req.body["payload"] || !req.body["payload"]["envelopeId"]) {
      console.log("Missing envelopeId");
      res.status(400).json({ message: "Missing envelopeId" });
      return;
    }

    const select = db.prepare(
      "SELECT COUNT(*) AS count FROM dossiers WHERE documenso_id = ? ORDER BY id DESC LIMIT 1",
    );

    const nb = select.get(req.body["payload"]["envelopeId"]);

    if (nb.count === 0) {
      console.log("Dossier not found");
      res.status(404).json({ message: "Dossier not found" });
      return;
    }

    const update = db.prepare(
      "UPDATE dossiers SET document_signed = 1 WHERE documenso_id = ? ORDER BY id DESC LIMIT 1",
    );
    update.run(req.body["payload"]["envelopeId"]);

    res.status(200).send("OK");
  } else {
    res.status(400).send("KO");
  }
});

// ----- Thanks page --------------------------------------------------------

app.get("/thanks", (_: express.Request, res: express.Response) => {
  res.status(200).sendFile(MEDIA_PATH + "thanks.html");
});

// ----- Version ------------------------------------------------------------

app.get("/version", (_: express.Request, res: express.Response) => {
  res.status(200).send(VERSION);
});

// ----- Healthcheck --------------------------------------------------------

app.get("/health", (_: express.Request, res: express.Response) => {
  res.status(200).send("OK");
});

// Start app

app.listen(PORT ? Number(PORT) : 3003);
