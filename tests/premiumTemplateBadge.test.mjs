import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isPremiumTemplate } from "../src/utils/templatePremium.js";
import { buildEditorTemplateSeed } from "../src/utils/editorTemplateSelection.js";
import { groupTemplateGraphicsBySubtype } from "../src/pages/Homepage/Component/templateGraphicsView.js";
const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

test("only explicitly premium catalog records get the badge", () => {
  assert.equal(isPremiumTemplate({templateAccess: "premium"}), true);
  for (const value of [null, {}, {templateAccess:"free"}, {templateAccess:"Premium"}, {templateAccess: true}]) {
    assert.equal(isPremiumTemplate(value), false);
  }
});
test("parent template is authoritative for graphic tiles", () => {
  const sections = groupTemplateGraphicsBySubtype([
    {Subtype:"Same", templateAccess:"premium", GraphicsLink:[{id:1,templateAccess:"free"}]},
    {Subtype:"Same", templateAccess:"free", GraphicsLink:[{id:2,templateAccess:"premium"}]},
  ]);
  assert.deepEqual(sections[0].items.map(isPremiumTemplate), [true,false]);
});
test("seed and selected graphic tier keep premium and free distinct", () => {
  const graphic={id:"a",url:"a.webp"};
  const values=["premium","free"].map(templateAccess=>buildEditorTemplateSeed({template:{id:templateAccess,templateAccess,GraphicsLink:[graphic]},selectedGraphic:graphic}));
  assert.deepEqual(values.map(isPremiumTemplate), [true,false]);
  assert.deepEqual(values.map(seed=>isPremiumTemplate({...graphic,_template:{templateAccess:seed.templateAccess}})), [true,false]);
});
test("existing UI entry points use one shared badge", () => {
  for (const file of ["ListOfGenaraltemp", "Festival", "Carosel", "AllTemplates"]) {
    assert.match(read(`src/pages/Homepage/Component/${file}.jsx`), /<PremiumTemplateBadge template=/);
  }
  assert.match(read("src/pages/Homepage/Homepage.jsx"), /<PremiumTemplateBadge template=\{item\} variant="inline"/);
  assert.match(read("src/components/AppPopup.jsx"), /<PremiumTemplateBadge template=\{popup.template\}/);
  assert.match(read("src/pages/Editor/components/ListOfTemplates.jsx"), /<PremiumTemplateBadge template=\{item\} variant="tile"/);
});
test("editor and shared form preview have no badge; catalog tile and export access stay intact", () => {
  const editor=read("src/pages/Editor/GenralEditPage.jsx");
  const form=read("src/pages/mainform/components/SalesExecutiveForm.jsx");
  assert.doesNotMatch(editor, /PremiumTemplateBadge/);
  assert.match(form, /<GeneralEditPage\s+previewOnly/);
  assert.doesNotMatch(form, /PremiumTemplateBadge/);
  assert.match(read("src/pages/Editor/components/ListOfTemplates.jsx"), /<PremiumTemplateBadge template=\{item\} variant="tile"/);
  assert.doesNotMatch(read("src/components/PremiumTemplateBadge.css"), /premium-template-badge--editor/);
  assert.match(editor,/canExportPoster\(selected.templateAccess/);
  assert.match(read("src/components/PremiumTemplateBadge.jsx"), /if \(!isPremiumTemplate\(template\)\) return null/);
  assert.match(read("src/components/PremiumTemplateBadge.css"), /pointer-events: none/);
});
