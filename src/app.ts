import express from "express";
import { PDFDocument, StandardFonts } from "pdf-lib";
import fs from "fs";
import stream from "stream";
import { fillForm } from "./helpers.ts";

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

const API_KEY = process.env.API_KEY || "";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

app.get("/event", (req: express.Request, res: express.Response) => {
  console.log("GET /event", req.query);
  res.status(200).json({ message: "OK" });
});

app.post("/register", async (req: express.Request, res: express.Response) => {
  console.log("POST /register");

  const token = req.headers["Authorization"] || req.headers["authorization"];

  if (!token || token !== `Bearer ${API_KEY}`) {
    console.log("Unauthorized");
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const dossierBenevoleFs = fs.readFileSync(
    "media/DossierBenevole_Annexes.pdf",
  );
  const charteBenevolatFs = fs.readFileSync("media/CharteDuBenevolat.pdf");
  const autorisationParentaleFs = fs.readFileSync(
    "media/AutorisationParentale.pdf",
  );

  // Load a PDF with form fields
  const dossierBenevolePdf = await PDFDocument.load(dossierBenevoleFs);
  const charteBenevolatPdf = await PDFDocument.load(charteBenevolatFs);
  const autorisationParentalePdf = await PDFDocument.load(
    autorisationParentaleFs,
  );

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
    diploma_1: req.body["answers"]["Tes diplômes et certifications"][0] || "",
    diploma_2: req.body["answers"]["Tes diplômes et certifications"][1] || "",
    diploma_3: req.body["answers"]["Tes diplômes et certifications"][2] || "",
    diploma_4: req.body["answers"]["Tes diplômes et certifications"][3] || "",
    diploma_5: req.body["answers"]["Tes diplômes et certifications"][4] || "",
    driving_licence_1: req.body["answers"]["Tes permis de conduire"][0] || "",
    driving_licence_2: req.body["answers"]["Tes permis de conduire"][1] || "",
    driving_licence_3: req.body["answers"]["Tes permis de conduire"][2] || "",
    driving_licence_4: req.body["answers"]["Tes permis de conduire"][3] || "",
    driving_licence_5: req.body["answers"]["Tes permis de conduire"][4] || "",
    activity_1_legal_guardian:
      req.body["answers"][
        "Déclare l'autoriser à participer aux activités ci-dessous organisées par la Croix-Rouge française, telles qu'elles m'ont été exposées"
      ][0] || "",
    activity_2_legal_guardian:
      req.body["answers"][
        "Déclare l'autoriser à participer aux activités ci-dessous organisées par la Croix-Rouge française, telles qu'elles m'ont été exposées"
      ][1] || "",
  };

  // DOSSIER BENEVOLE

  fillForm(
    dossierBenevolePdf.getForm(),
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

  const pdfBytes = await dossierBenevolePdf.save();
  fs.writeFileSync("media/DossierBenevole_Annexes_filled.pdf", pdfBytes);

  // CHARTE BENEVOLE

  const charteBenevolatForm = charteBenevolatPdf.getForm();

  fillForm(
    charteBenevolatForm,
    CORRESPONDENCE_TABLE_CHARTE_BENEVOLAT,
    req.body["answers"],
    computed,
  );

  charteBenevolatForm.flatten();

  const pdfBytesCharte = await charteBenevolatPdf.save();
  fs.writeFileSync("media/CharteDuBenevolat_filled.pdf", pdfBytesCharte);

  // AUTORISATION PARENTALE

  if (req.body["answers"]["Es-tu un mineur de moins de 16 ans ?"] === "Oui") {
    const autorisationParentaleForm = autorisationParentalePdf.getForm();

    fillForm(
      autorisationParentaleForm,
      CORRESPONDENCE_TABLE_AUTORISATION_PARTENTALE,
      req.body["answers"],
      computed,
    );

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

    const pdfBytesAutorisation = await autorisationParentalePdf.save();
    fs.writeFileSync(
      "media/AutorisationParentale_filled.pdf",
      pdfBytesAutorisation,
    );
  }

  // Send the filled PDF as a response

  const readStream = new stream.PassThrough();
  readStream.end(pdfBytes);
  res.set(
    "Content-disposition",
    "attachment; filename=" + "DossierBenevole.pdf",
  );
  res.set("Content-Type", "application/pdf");
  readStream.pipe(res);

  // TODO : SEND ALL PDFS TO SIGN
});

// Health check endpoint
app.get("/health", (_: express.Request, res: express.Response) => {
  res.status(200).send("OK");
});

app.listen(process.env.PORT ? Number(process.env.PORT) : 3003);
