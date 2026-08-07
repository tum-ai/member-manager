begin;

-- =========================================================================
-- Contract templates: 1:1 parity with the Word originals in data/contracts/,
-- a reverse-charge toggle, and room for an English body text.
--
-- The seeded wording was regenerated with
-- `node scripts/contracts/docx-to-template.mjs data/contracts/<file>.docx`,
-- which restores the § / (a) / (i) outline numbering, the full enumerations
-- and the Anlage references that the first conversion had condensed. Word
-- placeholders were then mapped onto the existing template variables.
--
-- Two deliberate deviations from the DOCX:
--   * Anlage 1 of the long-term contract is package specific -- the DOCX
--     itself instructs TUM.ai to adapt it per package -- so its draft items
--     are replaced by the catalog blocks the generator fills in.
--   * Each template gained a slot for the package benefits, add-ons and
--     special terms the generator maintains, plus the inline signature
--     tokens instead of blank signature rules.
--
-- Reverse charge: partners seated outside Germany must not get the VAT
-- sentence. The payment clause therefore carries the renderer's inline
-- conditional. The empty THEN branch is intentional -- an unset toggle falls
-- into ELSE, so the German VAT wording stays the default.
-- =========================================================================

alter table "public"."contract_templates"
    add column if not exists "contract_text_en" text;

comment on column "public"."contract_templates"."contract_text_en" is
    'English body text. Null or blank means the contract renders in German.';

update "public"."contract_templates"
set
    "description" = '1-year partnership contract, 1:1 from Sponsoringvertrag - TUM.ai e.V - Template - FF Entwurf (09. Februar 2026).docx.',
    "contract_text" = $contract$
- Bei diesem Dokument handelt es sich um einen Entwurf, welcher keine vertraglichen oder vorvertraglichen Rechte und Pflichten begründet -

SPONSORINGVERTRAG

zwischen

TUM.ai e.V.,
Arcisstraße 21
80333 München,

vertreten durch den Vorstand,

- im Folgenden "TUM.ai" genannt -

und

{{partner_company_name}},
{{partner_address}}

vertreten durch {{partner_representative}}

- im Folgenden "Partnerunternehmen" genannt -

- TUM.ai und das Partnerunternehmen zusammen die "Parteien" genannt -

Präambel

(1) TUM.ai ist ein gemeinnütziger Verein, der das Ziel verfolgt, immatrikulierte Studierende mit einem Interesse an Softwareentwicklung, maschinellem Lernen und künstlicher Intelligenz aus- und weiterzubilden. Dazu sollen die Studierenden die Möglichkeit erhalten, Praxiserfahrung im Rahmen verschiedener Projekte und Veranstaltungen zu sammeln.

(2) Das Partnerunternehmen ist {{partner_description}}.

(3) TUM.ai und das Partnerunternehmen streben eine langfristige partnerschaftliche Zusammenarbeit im Bereich des Sponsorings an.

Vor diesem Hintergrund treffen die Parteien die folgende Vereinbarung:

§ 1 Gegenstand des Vertrags

(a) Das Partnerunternehmen zahlt an TUM.ai nach entsprechender Rechnungstellung durch TUM.ai {{payment_interval}} bis zum {{payment_due_date}} einen Betrag in Höhe von {{package_amount_label}} (in Worten: {{package_amount_words}} Euro)[IF {{reverse_charge}} = "Yes" THEN {} ELSE { zuzüglich gesetzlich geschuldeter Umsatzsteuer}].

(b) Weitere Leistungen des Partnerunternehmens: {{custom_terms}}

(c) Als Gegenleistung erbringt TUM.ai an das Partnerunternehmen die in Anlage 1 genannten Leistungen.

(d) Die Realisierung der vom Partnerunternehmen mit der Eingehung dieses Vertrages verfolgten Ziele bleibt auf den Vergütungsanspruch von TUM.ai ohne Einfluss, vorbehaltlich einer Haftung von TUM.ai gemäß § 4.

(e) Die Parteien sind sich darüber einig, dass durch diesen Vertrag keine Exklusivität zugunsten des Partnerunternehmens begründet wird. TUM.ai bleibt insbesondere berechtigt, gleiche oder ähnliche Vereinbarungen mit anderen Partnern zu schließen und entsprechende Kooperationen durchzuführen.

§ 2 Schutzrechte

(a) TUM.ai gewährt dem Partnerunternehmen für die Laufzeit dieses Vertrages das einfache, nicht-ausschließliche, nicht-übertragbare, nicht-unterlizenzierbare und gebührenfreie Recht, den Namen und die in Anlage 2 Teil I spezifizierten Zeichen von TUM.ai in dem Umfang zu nutzen, wie dies zur Durchführung dieses Vertrags erforderlich ist.

(b) Das Partnerunternehmen gewährt TUM.ai für die Laufzeit dieses Vertrages das einfache, nicht-ausschließliche, nicht-übertragbare, nicht-unterlizenzierbare und gebührenfreie Recht, den Namen und die in Anlage 2 Teil II spezifizierten Zeichen des Partnerunternehmens in dem Umfang zu nutzen, wie dies zur Durchführung dieses Vertrags erforderlich ist.

(c) Die Parteien werden keine Handlungen vornehmen, die geeignet sind, den Ruf, den Geschäftsbetrieb oder die unter diesem Vertrag lizenzierten Rechte der jeweils anderen Partei in unangemessener Weise zu schädigen. Dies umfasst unter anderem:

(i) herabwürdigende oder geschäftsschädigende Äußerungen über die andere Partei, ihre Produkte oder Dienstleistungen;

(ii) die Nutzung der lizenzierten Rechte in einem rechtswidrigen, unethischen oder rufschädigenden Kontext; oder

(iii) das Bestreiten oder Anfechten der Gültigkeit oder der Inhaberschaft an den lizenzierten Rechten der anderen Partei.

§ 3 Vertraulichkeit

(a) Jede Partei wird die Vertraulichen Informationen der anderen Partei vertraulich behandeln. Vertrauliche Informationen im Sinne dieses Vertrages sind Informationen, die (i) ausdrücklich als "vertraulich", "geheim" oder einer ähnlichen Einstufung bezeichnet werden oder (ii) aus Sicht eines objektiven Empfängers und unter Berücksichtigung der Art der Information, der konkreten Umstände und der Art und Weise der Weitergabe und Kenntnisnahme als vertraulich oder geheim anzusehen sind, einschließlich Geschäftsinformationen und -strategien, Daten von Vereinsmitgliedern und Know-how. Dies gilt unabhängig davon, ob die Vertraulichen Informationen schriftlich, elektronisch, mündlich oder in einer anderen Form übermittelt wurden. Die Bestimmungen dieses Vertrages sind Vertrauliche Informationen beider Parteien.

(b) Jede Partei ist berechtigt, die Vertraulichen Informationen der anderen Partei gegenüber ihren Organen und Mitarbeitern und mit ihr im Sinne der §§ 15 ff. AktG verbundenen Unternehmen und Erfüllungsgehilfen (sowie deren Organen und Mitarbeitern) offenzulegen, sofern und soweit sie diese Informationen im Zusammenhang mit der Durchführung dieses Vertrags benötigen ("Need-to-know-Prinzip") und sofern sie jeweils einer den Schutz dieses Vertrags nicht unterschreitenden Vertraulichkeitsverpflichtung unterliegen. Zudem ist jede Partei berechtigt, die Vertraulichen Informationen der anderen Partei beruflich oder vertraglich zur Verschwiegenheit verpflichteten Beratern offenzulegen.

(c) Die Vertraulichkeitsverpflichtung besteht nicht, wenn und soweit:

(i) die Vertraulichen Informationen bei Vertragsschluss nachweislich öffentlich bekannt sind oder nach Vertragsschluss ohne Verschulden der empfangenden Partei öffentlich bekannt geworden sind;

(ii) die empfangende Partei die Vertraulichen Informationen von einem Dritten erlangt hat, sofern der Dritte seinerseits rechtmäßig in den Besitz der Informationen gelangt ist und durch die Weitergabe nicht gegen eine ihn bindende Vertraulichkeitsverpflichtung verstößt;

(iii) die Vertraulichen Informationen unabhängig und ohne Verwendung oder Bezugnahme auf die Vertraulichen Informationen der anderen Partei entwickelt wurden;

(iv) die offenbarende Partei für die Weitergabe der Vertraulichen Informationen an einen Dritten die vorherige schriftliche (Textform) Zustimmung gegenüber der empfangenden Partei erteilt hat; oder

(v) die empfangende Partei aufgrund gesetzlicher Pflichten, aufgrund von Vorschriften oder Regelwerken einer Börse oder aufgrund behördlicher oder gerichtlicher Anordnung zur Offenlegung verpflichtet ist.

(d) Soweit die Vertraulichen Informationen Geschäftsgeheimnisse im Sinne des Gesetzes zum Schutz von Geschäftsgeheimnissen (GeschGehG) enthalten, gilt die Vertraulichkeitsverpflichtung in diesem § 3 zeitlich so lange fort, wie die betreffende Information die Eigenschaft als Geschäftsgeheimnis besitzt. Im Übrigen endet die Vertraulichkeitsverpflichtung nach dem Ablauf von fünf (5) Jahren nach dem Ende der Vertragslaufzeit.

§ 4 Haftung

(a) TUM.ai haftet unbeschränkt für (i) Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, soweit diese auf einer fahrlässigen Pflichtverletzung von TUM.ai, seines gesetzlichen Vertreters oder Erfüllungsgehilfen beruhen und (ii) Schäden, die auf einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung von TUM.ai, seiner gesetzlichen Vertreter oder Erfüllungsgehilfen beruhen.

(b) Vorbehaltlich des vorstehenden Absatzes haftet TUM.ai für einfache Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten (sog. "Kardinalpflichten"). Kardinalpflichten sind Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung die jeweils andere Partei regelmäßig vertrauen darf. In diesem Fall ist die Haftung von TUM.ai auf den vertragstypischen und bei Vertragsschluss vorhersehbaren Schaden begrenzt, der bei dieser Art von Sponsoringvertrag typischerweise auftreten kann.

(c) Vorbehaltlich des § 4(a) und § 4(b) haftet TUM.ai nicht für entgangenen Gewinn und nicht für eine etwaige Nichterreichung der vom Partnerunternehmen mit der Eingehung dieses Vertrags verfolgten Ziele, soweit diese über die Erbringung der vertraglich geschuldeten Leistung von TUM.ai hinausgehen.

(d) Die in diesem § 4 genannten Haftungsbeschränkungen und -ausschlüsse gelten auch für die gesetzlichen Vertreter und Erfüllungsgehilfen von TUM.ai.

§ 5 Laufzeit und Kündigung

(a) Dieser Vertrag tritt am Datum der letzten Unterschrift der Parteien in Kraft und hat eine initiale Vertragslaufzeit bis zum {{end_date}}. Die Parteien werden spätestens drei (3) Monate vor Ablauf der Vertragslaufzeit in gutem Glauben Verhandlungen über eine Verlängerung dieses Vertrages führen.

(b) Nach Ablauf der initialen Vertragslaufzeit verlängert sich dieser Vertrag automatisch jeweils um ein weiteres Jahr, sofern er nicht von einer Partei mit einer Frist von einem (1) Monat zum Ende der initialen Laufzeit oder zum Ende der jeweiligen Verlängerungsperiode gekündigt wird.

(c) Das Recht beider Parteien zur außerordentlichen Kündigung des Vertrags aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt insbesondere vor, wenn die jeweils andere Partei schuldhaft eine ihr obliegende wesentliche vertraglich zugesicherte Leistung nicht erbringt und sie den Verstoß trotz Aufforderung zur Leistungserbringung mit angemessener Frist nicht behebt.

(d) Die Kündigung bedarf der Textform.

(e) Alle Bestimmungen, die aufgrund ihrer Natur oder einer ausdrücklichen Vereinbarung über die Beendigung dieses Vertrags hinaus Bestand haben, bleiben auch nach der Beendigung in vollem Umfang in Kraft und wirksam, einschließlich der folgenden Klauseln: § 1(e) (Loyalitätspflicht), § 3 (Vertraulichkeit) (für die in § 3(d) geregelte Laufzeit), § 4 (Haftung), § 5 (Kündigung) und § 8 (Gerichtsstand, anwendbares Recht).

§ 6 Kontaktdaten

Alle Mitteilungen im Zusammenhang mit diesem Vertrag sind zu richten an:

(a) Wenn sie an TUM.ai gerichtet sind, an die folgende Person und Adresse, sofern dem Partnerunternehmen nicht während der Vertragslaufzeit eine andere Person oder Adresse von TUM.ai als Empfänger mitgeteilt wurde:

An: TUM.ai e.V.
Zu Händen: {{tumai_contact_name}}
Adresse: Arcisstraße 21 80333 München
E-Mail: {{tumai_contact_email}}

(b) Wenn sie an das Partnerunternehmen gerichtet sind, an die folgende Person und Adresse, sofern TUM.ai nicht während der Vertragslaufzeit eine andere Person oder Adresse vom Partnerunternehmen als Empfänger mitgeteilt wurde:

An: {{partner_company_name}}
Zu Händen: {{partner_contact_name}}
Adresse: {{partner_address}}
E-Mail: {{partner_contact_email}}

§ 7 Vollständigkeit und salvatorische Klausel

(a) Mündliche Nebenabreden zwischen den Parteien bestehen nicht. Individuelle Vereinbarungen, die nach Vertragsschluss getroffen werden, sollen von einer der Parteien unverzüglich in Textform dokumentiert und der anderen Partei übermittelt werden.

(b) Sollten einzelne Bestimmungen dieses Vertrages ganz oder teilweise unwirksam beziehungsweise undurchführbar sein oder ihre Wirksamkeit oder Durchführbarkeit später verlieren, so wird hierdurch die Gültigkeit dieses Vertrages im Übrigen nicht berührt.

§ 8 Gerichtsstand, anwendbares Recht

(a) Gerichtsstand für alle sich aus oder im Zusammenhang mit diesem Vertrag ergebenen Rechtsstreitigkeiten ist ausschließlich München, Deutschland.

(b) Dieser Vertrag unterliegt hinsichtlich seines Zustandekommens und in allen seinen Wirkungen ausschließlich dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.

§ 9 Ausfertigungen und Form

(a) Dieser Vertrag kann in mehreren Ausfertigungen unterzeichnet werden, die jeweils als Original gelten, aber alle zusammen nur ein und dasselbe Rechtsgeschäft darstellen.

(b) Für einen wirksamen Abschluss dieses Vertrages ist die Übermittlung einer unterzeichneten Fassung dieses Vertrags per E-Mail (z. B. als PDF) oder eine Unterzeichnung mittels einer elektronischen Signaturplattform (z. B. DocuSign) unter Verwendung einer einfachen elektronischen Signatur ausreichend.

(Unterschriften folgen auf der nächsten Seite)

{{partner_company_name}}

Ort, Datum: ______________________________________________________
Name: {{partner_representative}}
Unterschrift: {{partner_signature}}

TUM.ai e.V.

Ort, Datum: ______________________________________________________
Name: {{tumai_signer_name}}
Unterschrift: {{board_signature}}

Anlage 1 - Leistungen von TUM.ai

1. TUM.ai räumt dem Partnerunternehmen das Recht ein, während der Laufzeit des Vertrages die Bezeichnung "Offizielles Partnerunternehmen von TUM.ai" zu führen.

2. TUM.ai wird während der Laufzeit des Vertrages den Namen und / oder die in Anlage 2 spezifizierten Zeichen des Partnerunternehmens auf der Website von TUM.ai als {{package_label}} führen. TUM.ai behält sich das Recht vor, den Namen und / oder die in Anlage 2 spezifizierten Zeichen des Partnerunternehmens nach billigem Ermessen auch an anderer Stelle zu veröffentlichen (etwa auf Druckerzeugnissen, in Social Media Postings, Werbematerialien).

3. Das vereinbarte Sponsoringpaket umfasst die folgenden Leistungen:
{{package_benefits}}

4. Zusätzlich vereinbarte Add-ons:
{{addon_terms}}

5. Gesamtbetrag: {{total_amount_label}}

Hinweis: {{package_footnote}}

Anlage 2 - Zeichen der Parteien

Teil I - Zeichen von TUM.ai

nach gesonderter Bereitstellung durch TUM.ai

Teil II - Zeichen des Partnerunternehmens

nach gesonderter Bereitstellung durch das Partnerunternehmen
$contract$,
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000001';

update "public"."contract_templates"
set
    "description" = 'One-off hackathon sponsorship contract, 1:1 from Hackathon_Sponsoringvorlage.docx.',
    "contract_text" = $contract$
KOOPERATIONSVERTRAG

zwischen

TUM.ai e.V.,
vertreten durch den Vorstand,
Arcisstraße 21
80333 München
- im Folgenden Veranstalter genannt -

und

{{partner_company_name}},
vertreten durch den {{partner_representative}} anderweitig mit Vertretungsmacht ausgestattete Personen,
{{partner_address}}
- im Folgenden Partnerunternehmen genannt -

Präambel
Der Veranstalter ist ein gemeinnütziger Verein, der das Ziel verfolgt, immatrikulierte Studenten mit einem Interesse an Softwareentwicklung, maschinellem Lernen und künstlicher Intelligenz aus- und weiterzubilden. Dazu sollen die Studenten die Möglichkeit erhalten, Praxiserfahrung im Rahmen verschiedener Projekte zu sammeln.
TUM.ai e.V. richtet dazu während des Semesters mehrere Hackathons in Kooperation mit Partnern aus. Im Rahmen dieser Veranstaltungen bereiten die jeweiligen Partner verschiedene Problemstellungen vor, die anschließend von den Teilnehmenden gelöst werden.
Das Partnerunternehmen verspricht sich von einer Unterstützung des {{event_name}} - im Folgenden Veranstaltung oder Hackathon genannt - eine Erhöhung seines unternehmerischen Ansehens und ist an einer Einräumung von Werbemöglichkeiten interessiert. Das Partnerunternehmen hat sich daher bereit erklärt, durch finanzielle Zuwendungen die Ausrichtung dieser Veranstaltung zu unterstützen. Zu diesem Zweck vereinbaren der Veranstalter und das Partnerunternehmen - im Folgenden Parteien genannt - Folgendes:

§ 1 Veranstaltung
Der Veranstalter wird in der Zeit vom {{event_start_date}} bis einschließlich {{event_end_date}} am Veranstaltungsort in {{event_location}} einen Hackathon mit dem Titel {{event_name}} ausrichten. Dem Annex lässt sich ein vorläufiger und unverbindlicher Ablaufplan entnehmen, der das Veranstaltungsprogramm im Groben skizziert (Annex 1). Der Veranstalter behält sich Änderungen des Ablaufplans vor.

§ 2 Leistungen des Partnerunternehmens
Das Partnerunternehmen erbringt für die in § 3 genannten Gegenleistungen des Veranstalters folgende Leistungen:
a) Zahlung eines einmaligen Geldbetrags in Höhe von {{package_amount_label}} (in Worten: {{package_amount_words}} Euro)[IF {{reverse_charge}} = "Yes" THEN {} ELSE { zuzüglich gesetzlich darauf anfallender Umsatzsteuer in Höhe von 19 %}]. Die Zahlung wird zwei Wochen nach Ausstellung der Rechnung fällig, die Rechnung wird nach Vertragsschluss ausgestellt. Zahlungen des Partnerunternehmens haben bargeldlos auf das folgende Konto des Veranstalters zu erfolgen: {{payment_account}}. Die Realisierung der vom Partnerunternehmen mit der Eingehung dieses Vertrages verfolgten kommunikativen Ziele bleibt auf den Vergütungsanspruch des Veranstalters ohne Einfluss.
b) Zurverfügungstellung seiner Räumlichkeiten für den gesamten Zeitraum.
c) Vollumfängliches Aufkommen für die Verpflegung der Teilnehmer
d) Vorbereitung von Problemstellungen für die Teilnehmer.
e) Stellung der Siegerpreise sowie Jury.
f) Vollumfängliche Bewerbung des Hackathons auf sämtlichen seiner digitalen Kanäle. Das Partnerunternehmen wird das Logo vom Veranstalter auf sämtlichen Werbematerialien betreffend den Hackathon präsentieren.
g) Einräumung der Nutzungsrechte am eigenen Logo zum Zwecke der Erfüllung der unter § 3 vereinbarten Werbeleistungen des Veranstalters.

§ 3 Leistungen des Veranstalters
Der Veranstalter erbringt folgende Gegenleistungen:
a) Das Partnerunternehmen erhält das Recht, die Bezeichnung "Offizielles Partnerunternehmen des {{event_name}}" zu verwenden.
b) Der Veranstalter wird das Partnerunternehmen im Vorfeld des Hackathons hinsichtlich der technischen Durchführbarkeit der Problemstellungen beraten.
c) Der Veranstalter verpflichtet sich, das Partnerunternehmen auf seinen Social Media Kanälen (v.a. Instagram und LinkedIn) in Zusammenhang mit dem Hackathon explizit zu erwähnen. TUM.ai ist ausdrücklich nicht dazu verpflichtet, gewisse Kennzahlen, wie zum Beispiel erreichte Konten, Impressionen oder Likes, vorzuweisen. Das Partnerunternehmen ist sich bewusst, dass der Erfolg der Social Media Posts zu einem nicht unerheblichen Teil von den Algorithmen des jeweiligen sozialen Netzwerkes abhängig sind und TUM.ai jene Algorithmen nicht beeinflussen kann.
d) Das Logo des Partnerunternehmens wird auf der Website des Veranstalters und unter Umständen auf weiteren Werbematerialien betreffend des Hackathons integriert.
e) Der Veranstalter wird den Hackathon auf sämtlichen seiner Social Media Kanäle vollumfänglich bewerben und die Teilnehmenden auswählen. TUM.ai ist nicht verpflichtet eine Mindestteilnehmeranzahl zu gewährleisten. Die Teilnehmenden werden von TUM.ai nach bestem Wissen und Gewissen ausgewählt.
f) Der Veranstalter gewährt dem Partnerunternehmen uneingeschränkten Zugang zu den LinkedIn-Profilen und Lebensläufen aller Teilnehmenden des Hackathons.
g) Der Veranstalter stellt dem Partnerunternehmen eine exklusive Präsentationsfläche (Onsite-Booth) für Einzelgespräche sowie Vernetzung mit den Hackathon-Teilnehmenden zur Verfügung.
h) Der Veranstalter erlaubt die Nutzung seines Logos (siehe Annex 2) für die unter § 2 vereinbarten Leistungen seitens des Partnerunternehmens.
i) Folgende weitere Leistungen sind im gewählten Sponsoring-Paket enthalten:
{{package_benefits}}
j) Zusätzlich vereinbarte Add-ons:
{{addon_terms}}
k) Besondere Vereinbarungen:
{{custom_terms}}

§ 4 Vertraulichkeit
(1) Die Parteien werden über den Inhalt, Umfang und die Konditionen dieses Vertrages sowie vertrauliche Informationen wie persönliche Daten absolutes Stillschweigen bewahren, auch nach Beendigung des Vertrags.
(2) Dies gilt unabhängig davon, ob sie schriftlich, elektronisch, mündlich oder in einer anderen Form übermittelt werden oder wurden. Es ist dabei unerheblich, ob diese Informationen als "vertraulich" oder "geschützt" gekennzeichnet oder anderweitig als solche bezeichnet sind oder ob ein Hinweis auf ihre Vertraulichkeit oder ihren Schutz vorliegt.
(3) Die Offenlegung gegenüber Dritten ist nur aufgrund zwingender gesetzlicher Bestimmungen oder unanfechtbarer behördlicher wie gerichtlicher Anordnung zulässig, es sei denn, die jeweils andere Partei hat vorher ausdrücklich und schriftlich eingewilligt oder Inhalt, Umfang und/oder die Konditionen dieses Vertrags sind anders als durch eine Vertragsverletzung der sich äußernden Partei bereits öffentlich bekannt geworden.
(4) Die Vertraulichkeitsverpflichtungen gelten uneingeschränkt ebenso im Verhältnis des Partnerunternehmens zu den teilnehmenden Personen, besonders im Hinblick auf die den Lebensläufen zu entnehmenden persönlichen Daten. Für etwaige Verletzungen und Schadensersatzforderungen in diesem Verhältnis haftet ausschließlich das Partnerunternehmen selbst.

§ 5 Schutzrechte
Das Partnerunternehmen hat keinerlei Rechte jedweder Art an den von den Teilnehmenden entwickelten Lösungen, soweit zwischen dem Partnerunternehmen und den Teilnehmenden nichts Anderweitiges vereinbart wurde.

§ 6 Haftung
(1) Soweit nicht wesentliche Vertragspflichten verletzt werden, haften die Parteien einander ausschließlich für Schäden, die auf einer grob fahrlässigen oder vorsätzlichen Pflichtverletzung der jeweiligen Partei oder deren Erfüllungsgehilfen beruhen. Wesentliche Vertragspflichten sind solche Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung die jeweils andere Partei regelmäßig vertrauen darf. Die nach § 309 Nr. 7 lit. a, b BGB nicht abdingbare Haftung bleibt hiervon unberührt.
(2) Der Veranstalter haftet über die Erbringung seiner vertraglich geschuldeten Leistung hinaus nicht für eine etwaige Nichterreichung der vom Partnerunternehmen mit der Eingehung dieses Kooperationsvertrags verfolgten Erfolgs- oder Kennzahlen, es sei denn, der Veranstalter hat deren Realisierung durch schuldhafte Verletzung wesentlicher vertraglicher Pflichten und/oder durch vorsätzliche oder grob fahrlässige sonstige Pflichtverletzungen erschwert oder vereitelt. Zu kommunikativen Zielen gehört etwa die Anzahl der Teilnehmer und die dazugehörige Anzahl an Lebensläufen oder erreichten Konten auf Social Media. Zu den verfolgten Zielen gehören unter anderem der Werbeerfolg, der wirtschaftliche sowie der technische Erfolg eines Endproduktes. Es ist grundsätzlich möglich, dass keiner der Teilnehmenden eine zufriedenstellende Lösung erarbeiten kann. Das damit verbundene Risiko trägt das Partnerunternehmen.

§ 7 Schriftformklausel
(1) Mündliche Nebenabreden zwischen den Parteien bestehen nicht.
(2) Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Dies gilt auch für diesen § 7 Abs. 2.

§ 8 Salvatorische Klausel
(1) Sollten einzelne Bestimmungen dieses Vertrages ganz oder teilweise unwirksam beziehungsweise undurchführbar sein oder ihre Wirksamkeit oder Durchführbarkeit später verlieren, so wird hierdurch die Gültigkeit dieses Vertrages im Übrigen nicht berührt.
(2) Im Falle einer unwirksamen Bestimmung sind die Parteien verpflichtet, diese unter billiger Berücksichtigung der beiderseitigen Interessen durch eine wirksame Bestimmung zu ersetzen, die dem mit der unwirksamen Bestimmung angestrebten wirtschaftlichen Ergebnis am nächsten kommt. Entsprechendes gilt im Falle einer Lücke, wenn die Parteien bei Abschluss dieses Vertrags den offenen Punkt bedacht hätten.

§ 9 Vertragsdauer
(1) Dieser Vertrag tritt mit der Unterzeichnung durch beide Vertragsparteien mit dem Datum der zuletzt geleisteten Unterschrift in Kraft.
(2) Dieser Vertrag endet mit der Vollendung des Hackathons. Die in § 4 vereinbarte Vertraulichkeit ist auch über das Vertragsende hinaus dauerhaft zu wahren.

§ 10 Kündigung
(1) Den Parteien steht das gesetzliche Rücktrittsrecht zu.
(2) Darüber hinaus sind die Parteien ausnahmsweise dazu berechtigt, den Vertrag ohne Einhaltung Frist zu kündigen, wenn die jeweils andere Partei schuldhaft eine ihr obliegende wesentliche vertraglich zugesicherte Leistung nicht erbringt und sie den Verstoß trotz Abmahnung mit angemessener Frist zur Abhilfe nicht beseitigt.
(3) Das Recht zur außerordentlichen Kündigung des Vertrags aus wichtigem Grund bleibt unberührt.
(4) Die Kündigung bedarf der Schriftform.

§ 11 Gerichtsstand, anwendbares Recht, Auslegung
(1) Gerichtsstand für alle sich aus oder im Zusammenhang mit diesem Vertrag ergebenen Rechtsstreitigkeiten ist ausschließlich München, Deutschland.
(2) Dieser Vertrag unterliegt hinsichtlich seines Zustandekommens und in allen seinen Wirkungen ausschließlich dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
(3) Die Präambel ist für die Auslegung dieses Vertrags heranzuziehen.

{{partner_company_name}}
Ort, Datum: ______________________
Name: {{partner_representative}}
Unterschrift: {{partner_signature}}

TUM.ai e.V.
Ort, Datum: ______________________
Name: {{tumai_signer_name}}
Unterschrift: {{board_signature}}

Annex 1

Annex 2
$contract$,
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000002';

update "public"."contract_templates"
set
    "description" = 'AI E-Lab jury-seat sponsorship contract, 1:1 from AI E-Lab_Sponsoringvorlage.docx.',
    "contract_text" = $contract$
KOOPERATIONSVERTRAG

zwischen

TUM.ai e.V.,
vertreten durch den Vorstand,
Arcisstraße 21
80333 München
- im Folgenden Veranstalter genannt -

und

{{partner_company_name}},
vertreten durch den {{partner_representative}} oder anderweitig mit Vertretungsmacht ausgestattete Personen,
{{partner_address}}
- im Folgenden Partnerunternehmen genannt -

Präambel
Der Veranstalter ist ein gemeinnütziger Verein, der das Ziel verfolgt, immatrikulierte Studenten mit einem Interesse an Softwareentwicklung, maschinellem Lernen und künstlicher Intelligenz aus- und weiterzubilden. Dazu sollen die Studenten die Möglichkeit erhalten, Praxiserfahrung im Rahmen verschiedener Projekte zu sammeln.
TUM.ai e.V. betreibt dazu unter anderem ein Startup-Inkubator-Programm, das sogenannte AI Entrepreneurship Lab (AI E-Lab). Im Rahmen dieses dreimonatigen Programms begehen Teilnehmer den gesamten Gründerweg von Ideenfindung bis zum Pitch ihres Startups. Auf diesem Weg werden die Teams von Mentoren aus der Praxis unterstützt. Am Ende steht das Final Pitch Event bevor, bei dem sich die Gründer zusätzlich mit Partnerunternehmen von TUM.ai vernetzen können.
Das Partnerunternehmen verspricht sich von einer Unterstützung des AI E-Lab - im Folgenden Veranstaltung genannt - eine Erhöhung seines unternehmerischen Ansehens und ist an einer Einräumung von Werbemöglichkeiten interessiert. Das Partnerunternehmen hat sich daher bereit erklärt, durch finanzielle Zuwendungen die Ausrichtung dieser Veranstaltung zu unterstützen. Zu diesem Zweck vereinbaren der Veranstalter und das Partnerunternehmen - im Folgenden Parteien genannt - Folgendes:

§ 1 Veranstaltung
Der Veranstalter wird in der Zeit vom {{event_start_date}} bis einschließlich {{event_end_date}} am Veranstaltungsort in {{event_location}} das AI E-Lab ausrichten. Dem Annex lässt sich ein vorläufiger und unverbindlicher Ablaufplan entnehmen, der das Veranstaltungsprogramm im Groben skizziert (Annex 1). Der Veranstalter behält sich Änderungen des Ablaufplans vor.

§ 2 Leistungen des Partnerunternehmens
Das Partnerunternehmen erbringt für die in § 3 genannten Gegenleistungen des Veranstalters folgende Leistungen:
a) Zahlung eines einmaligen Geldbetrags in Höhe von {{package_amount_label}} (in Worten: {{package_amount_words}} Euro)[IF {{reverse_charge}} = "Yes" THEN {} ELSE { zuzüglich gesetzlich darauf anfallender Umsatzsteuer in Höhe von 19 %}]. Die Zahlung wird zwei Wochen nach Ausstellung der Rechnung fällig, die Rechnung wird nach Vertragsschluss ausgestellt. Zahlungen des Partnerunternehmens haben bargeldlos auf das folgende Konto des Veranstalters zu erfolgen: {{payment_account}}. Die Realisierung der vom Partnerunternehmen mit der Eingehung dieses Vertrages verfolgten kommunikativen Ziele bleibt auf den Vergütungsanspruch des Veranstalters ohne Einfluss.
b) Einräumung der Nutzungsrechte am eigenen Logo (siehe Annex 2) zum Zwecke der Erfüllung der unter § 3 vereinbarten Werbeleistungen des Veranstalters.

§ 3 Leistungen des Veranstalters
Der Veranstalter erbringt folgende Gegenleistungen:
a) Das Partnerunternehmen erhält das Recht, die Bezeichnung "Offizielles Partnerunternehmen des AI Entrepreneurship Lab" zu verwenden.
b) Das Logo des Partnerunternehmens wird während der Laufzeit des Vertrages auf der Website des Veranstalters und unter Umständen auf weiteren Werbematerialien betreffend der Veranstaltung integriert.
c) Folgende weitere Leistungen sind im Sponsoring-Paket erhalten:
- Hervorhebung und Nennung als Partnerunternehmen in bis zu drei (3) Posts auf den Social Media Kanälen von TUM.ai vor Vollendung des AI E-Lab;
- Durchführung von einem (1) Workshop mit dem Partnerunternehmen im Rahmen des AI E-Lab Programms;
- Einladung von maximal bis zu fünf (5) Mitarbeitenden des Partnerunternehmens zu einem privaten AI E-Lab Meet & Mingle Event;
- Nominierung eines (1) Jury Mitglieds des Partnerunternehmens zum Final Pitch Event des AI E-Lab;
- Zurverfügungstellung von maximal fünf (5) Tickets für das Final Pitch Event des AI E-Lab;
- Möglichkeit zur Veröffentlichung von Stellenausschreibungen innerhalb der internen Slack-Community von TUM.ai;
{{package_benefits}}

d) Besondere Vereinbarungen:
{{custom_terms}}

§ 4 Vertraulichkeit
(1) Die Parteien werden über den Inhalt, Umfang und die Konditionen dieses Vertrages sowie vertrauliche Informationen wie persönliche Daten absolutes Stillschweigen bewahren, auch nach Beendigung des Vertrags.
(2) Dies gilt unabhängig davon, ob sie schriftlich, elektronisch, mündlich oder in einer anderen Form übermittelt werden oder wurden. Es ist dabei unerheblich, ob diese Informationen als "vertraulich" oder "geschützt" gekennzeichnet oder anderweitig als solche bezeichnet sind oder ob ein Hinweis auf ihre Vertraulichkeit oder ihren Schutz vorliegt.
(3) Die Offenlegung gegenüber Dritten ist nur aufgrund zwingender gesetzlicher Bestimmungen oder unanfechtbarer behördlicher wie gerichtlicher Anordnung zulässig, es sei denn, die jeweils andere Partei hat vorher ausdrücklich und schriftlich eingewilligt oder Inhalt, Umfang und/oder die Konditionen dieses Vertrags sind anders als durch eine Vertragsverletzung der sich äußernden Partei bereits öffentlich bekannt geworden.

§ 5 Haftung
(1) Soweit nicht wesentliche Vertragspflichten verletzt werden, haften die Parteien einander ausschließlich für Schäden, die auf einer grob fahrlässigen oder vorsätzlichen Pflichtverletzung der jeweiligen Partei oder deren Erfüllungsgehilfen beruhen. Wesentliche Vertragspflichten sind solche Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung die jeweils andere Partei regelmäßig vertrauen darf. Die nach § 309 Nr. 7 lit. a, b BGB nicht abdingbare Haftung bleibt hiervon unberührt.
(2) Der Veranstalter haftet über die Erbringung seiner vertraglich geschuldeten Leistung hinaus nicht für eine etwaige Nichterreichung der vom Partnerunternehmen mit der Eingehung dieses Kooperationsvertrags verfolgten kommunikativen Ziele, es sei denn, der Veranstalter hat deren Realisierung durch schuldhafte Verletzung wesentlicher vertraglicher Pflichten und/oder durch vorsätzliche oder grob fahrlässige sonstige Pflichtverletzungen erschwert oder vereitelt. Zu den verfolgten Zielen gehören unter anderem der Werbeerfolg, der wirtschaftliche sowie der technische Erfolg eines Endproduktes.

§ 6 Schriftformklausel
(1) Mündliche Nebenabreden zwischen den Parteien bestehen nicht.
(2) Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Dies gilt auch für diesen § 6 Abs. 2.

§ 7 Salvatorische Klausel
(1) Sollten einzelne Bestimmungen dieses Vertrages ganz oder teilweise unwirksam beziehungsweise undurchführbar sein oder ihre Wirksamkeit oder Durchführbarkeit später verlieren, so wird hierdurch die Gültigkeit dieses Vertrages im Übrigen nicht berührt.
(2) Im Falle einer unwirksamen Bestimmung sind die Parteien verpflichtet, diese unter billiger Berücksichtigung der beiderseitigen Interessen durch eine wirksame Bestimmung zu ersetzen, die dem mit der unwirksamen Bestimmung angestrebten wirtschaftlichen Ergebnis am nächsten kommt. Entsprechendes gilt im Falle einer Lücke, wenn die Parteien bei Abschluss dieses Vertrags den offenen Punkt bedacht hätten.

§ 8 Vertragsdauer
(1) Dieser Vertrag tritt mit der Unterzeichnung durch beide Vertragsparteien mit dem Datum der zuletzt geleisteten Unterschrift in Kraft.
(2) Dieser Vertrag endet entweder automatisch nach {{contract_end_description}} oder durch Kündigung. Die in § 4 vereinbarte Vertraulichkeit ist auch über das Vertragsende hinaus dauerhaft zu wahren.
(3) Der Vertrag kann durch schriftliche Mitteilung des Partnerunternehmens und Annahme dieses Angebots durch den Veranstalter ohne Nachtrag verlängert werden.

§ 9 Kündigung
(1) Den Parteien steht das gesetzliche Rücktrittsrecht zu.
(2) Darüber hinaus sind die Parteien ausnahmsweise dazu berechtigt, den Vertrag ohne Einhaltung Frist zu kündigen, wenn die jeweils andere Partei schuldhaft eine ihr obliegende wesentliche vertraglich zugesicherte Leistung nicht erbringt und sie den Verstoß trotz Abmahnung mit angemessener Frist zur Abhilfe nicht beseitigt.
(3) Das Recht zur außerordentlichen Kündigung des Vertrags aus wichtigem Grund bleibt unberührt.
(4) Die Kündigung bedarf der Schriftform.

§ 10 Gerichtsstand, anwendbares Recht, Auslegung
(1) Gerichtsstand für alle sich aus oder im Zusammenhang mit diesem Vertrag ergebenen Rechtsstreitigkeiten ist ausschließlich München, Deutschland.
(2) Dieser Vertrag unterliegt hinsichtlich seines Zustandekommens und in allen seinen Wirkungen ausschließlich dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
(3) Die Präambel ist für die Auslegung dieses Vertrags heranzuziehen.

{{partner_company_name}}
Ort, Datum: ______________________
Name: {{partner_representative}}
Unterschrift: {{partner_signature}}

TUM.ai e.V.
Ort, Datum: ______________________
Name: {{tumai_signer_name}}
Unterschrift: {{board_signature}}

Annex 1

Annex 2
$contract$,
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000003';

update "public"."contract_templates"
set
    "description" = 'One-off event sponsorship contract, 1:1 from Einzelevents_Sponsoringvorlage.docx.',
    "contract_text" = $contract$
KOOPERATIONSVERTRAG

zwischen

TUM.ai e.V.,
vertreten durch den Vorstand,
Arcisstraße 21
80333 München
- im Folgenden Veranstalter genannt -

und

{{partner_company_name}},
vertreten durch den {{partner_representative}} oder anderweitig mit Vertretungsmacht ausgestattete Personen,
{{partner_address}}
- im Folgenden Partnerunternehmen genannt -

Präambel
Der Veranstalter ist ein gemeinnütziger Verein, der das Ziel verfolgt, immatrikulierte Studenten mit einem Interesse an Softwareentwicklung, maschinellem Lernen und künstlicher Intelligenz aus- und weiterzubilden. Dazu sollen die Studenten die Möglichkeit erhalten, Praxiserfahrung im Rahmen verschiedener Projekte zu sammeln.
Der Veranstalter organisiert dazu unter anderem {{event_description}}.
Das Partnerunternehmen verspricht sich von einer Unterstützung des {{event_name}} - im Folgenden Veranstaltung genannt - eine Erhöhung seines unternehmerischen Ansehens und ist an einer Einräumung von Werbemöglichkeiten interessiert. Das Partnerunternehmen hat sich daher bereit erklärt, durch finanzielle Zuwendungen die Ausrichtung dieser Veranstaltung zu unterstützen. Zu diesem Zweck vereinbaren der Veranstalter und das Partnerunternehmen - im Folgenden Parteien genannt - Folgendes:

§ 1 Veranstaltung
Der Veranstalter wird in der Zeit vom {{event_start_date}} bis einschließlich {{event_end_date}} am Veranstaltungsort in {{event_location}} einen {{event_type}} mit dem Titel {{event_name}} ausrichten. Dem Annex lässt sich ein vorläufiger und unverbindlicher Ablaufplan entnehmen, der das Veranstaltungsprogramm im Groben skizziert (Annex 1). Der Veranstalter behält sich Änderungen des Ablaufplans vor.

§ 2 Leistungen des Partnerunternehmens
Das Partnerunternehmen erbringt für die in § 3 genannten Gegenleistungen des Veranstalters folgende Leistungen:
a) Zahlung eines einmaligen Geldbetrags in Höhe von {{sponsoring_amount_label}} EUR (in Worten: {{sponsoring_amount_words}} Euro)[IF {{reverse_charge}} = "Yes" THEN {} ELSE { zuzüglich gesetzlich darauf anfallender Umsatzsteuer in Höhe von 19 %}]. Die Zahlung wird zwei Wochen nach Ausstellung der Rechnung fällig, die Rechnung wird nach Vertragsschluss ausgestellt. Zahlungen des Partnerunternehmens haben bargeldlos auf das folgende Konto des Veranstalters zu erfolgen: {{payment_account}}. Die Realisierung der vom Partnerunternehmen mit der Eingehung dieses Vertrages verfolgten kommunikativen Ziele bleibt auf den Vergütungsanspruch des Veranstalters ohne Einfluss.
b) Einräumung der Nutzungsrechte am eigenen Logo zum Zwecke der Erfüllung der unter § 3 vereinbarten Werbeleistungen des Vereins.

§ 3 Leistungen des Veranstalters
Der Veranstalter erbringt folgende Gegenleistungen:
a) Das Partnerunternehmen erhält das Recht, die Bezeichnung "Offizielles Partnerunternehmen des {{event_name}}" zu verwenden.
b) Das Logo des Partnerunternehmens wird während der Laufzeit des Vertrages auf der Website des Veranstalters und unter Umständen auf weiteren Werbematerialien betreffend der Veranstaltung integriert.
c) Folgende weitere Leistungen sind im Sponsoring-Paket enthalten:
{{package_benefits}}

d) Besondere Vereinbarungen:
{{custom_terms}}

§ 4 Vertraulichkeit
(1) Die Parteien werden über den Inhalt, Umfang und die Konditionen dieses Vertrages sowie vertrauliche Informationen wie persönliche Daten absolutes Stillschweigen bewahren, auch nach Beendigung des Vertrags.
(2) Dies gilt unabhängig davon, ob sie schriftlich, elektronisch, mündlich oder in einer anderen Form übermittelt werden oder wurden. Es ist dabei unerheblich, ob diese Informationen als "vertraulich" oder "geschützt" gekennzeichnet oder anderweitig als solche bezeichnet sind oder ob ein Hinweis auf ihre Vertraulichkeit oder ihren Schutz vorliegt.
(3) Die Offenlegung gegenüber Dritten ist nur aufgrund zwingender gesetzlicher Bestimmungen oder unanfechtbarer behördlicher wie gerichtlicher Anordnung zulässig, es sei denn, die jeweils andere Partei hat vorher ausdrücklich und schriftlich eingewilligt oder Inhalt, Umfang und/oder die Konditionen dieses Vertrags sind anders als durch eine Vertragsverletzung der sich äußernden Partei bereits öffentlich bekannt geworden.

§ 5 Haftung
(1) Soweit nicht wesentliche Vertragspflichten verletzt werden, haften die Parteien einander ausschließlich für Schäden, die auf einer grob fahrlässigen oder vorsätzlichen Pflichtverletzung der jeweiligen Partei oder deren Erfüllungsgehilfen beruhen. Wesentliche Vertragspflichten sind solche Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung die jeweils andere Partei regelmäßig vertrauen darf. Die nach § 309 Nr. 7 lit. a, b BGB nicht abdingbare Haftung bleibt hiervon unberührt.
(2) Der Veranstalter haftet über die Erbringung seiner vertraglich geschuldeten Leistung hinaus nicht für eine etwaige Nichterreichung der vom Partnerunternehmen mit der Eingehung dieses Kooperationsvertrags verfolgten kommunikativen Ziele, es sei denn, der Veranstalter hat deren Realisierung durch schuldhafte Verletzung wesentlicher vertraglicher Pflichten und/oder durch vorsätzliche oder grob fahrlässige sonstige Pflichtverletzungen erschwert oder vereitelt.

§ 6 Schriftformklausel
(1) Mündliche Nebenabreden zwischen den Parteien bestehen nicht.
(2) Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Dies gilt auch für diesen § 6 Abs. 2.

§ 7 Salvatorische Klausel
(1) Sollten einzelne Bestimmungen dieses Vertrages ganz oder teilweise unwirksam beziehungsweise undurchführbar sein oder ihre Wirksamkeit oder Durchführbarkeit später verlieren, so wird hierdurch die Gültigkeit dieses Vertrages im Übrigen nicht berührt.
(2) Im Falle einer unwirksamen Bestimmung sind die Parteien verpflichtet, diese unter billiger Berücksichtigung der beiderseitigen Interessen durch eine wirksame Bestimmung zu ersetzen, die dem mit der unwirksamen Bestimmung angestrebten wirtschaftlichen Ergebnis am nächsten kommt. Entsprechendes gilt im Falle einer Lücke, wenn die Parteien bei Abschluss dieses Vertrags den offenen Punkt bedacht hätten.

§ 8 Vertragsdauer
(1) Dieser Vertrag tritt mit der Unterzeichnung durch beide Vertragsparteien mit dem Datum der zuletzt geleisteten Unterschrift in Kraft.
(2) Dieser Vertrag endet entweder automatisch nach {{contract_end_description}} oder durch Kündigung. Die in § 4 vereinbarte Vertraulichkeit ist auch über das Vertragsende hinaus dauerhaft zu wahren.
(3) Der Vertrag kann durch schriftliche Mitteilung des Partnerunternehmens und Annahme dieses Angebots durch den Veranstalter ohne Nachtrag verlängert werden.

§ 9 Kündigung
(1) Den Parteien steht das gesetzliche Rücktrittsrecht zu.
(2) Darüber hinaus sind die Parteien ausnahmsweise dazu berechtigt, den Vertrag ohne Einhaltung Frist zu kündigen, wenn die jeweils andere Partei schuldhaft eine ihr obliegende wesentliche vertraglich zugesicherte Leistung nicht erbringt und sie den Verstoß trotz Abmahnung mit angemessener Frist zur Abhilfe nicht beseitigt.
(3) Das Recht zur außerordentlichen Kündigung des Vertrags aus wichtigem Grund bleibt unberührt.
(4) Die Kündigung bedarf der Schriftform.

§ 10 Gerichtsstand, anwendbares Recht, Auslegung
(1) Gerichtsstand für alle sich aus oder im Zusammenhang mit diesem Vertrag ergebenen Rechtsstreitigkeiten ist ausschließlich München, Deutschland.
(2) Dieser Vertrag unterliegt hinsichtlich seines Zustandekommens und in allen seinen Wirkungen ausschließlich dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
(3) Die Präambel ist für die Auslegung dieses Vertrags heranzuziehen.

{{partner_company_name}}
Ort, Datum: ______________________
Name: {{partner_representative}}
Unterschrift: {{partner_signature}}

TUM.ai e.V.
Ort, Datum: ______________________
Name: {{tumai_signer_name}}
Unterschrift: {{board_signature}}

Annex 1
$contract$,
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000004';

update "public"."contract_templates"
set
    "description" = 'Makeathon sponsorship contract, 1:1 from Makeathon_Sponsoringvorlage.docx.',
    "contract_text" = $contract$
KOOPERATIONSVERTRAG

zwischen

TUM.ai e.V.,
vertreten durch den Vorstand,
Arcisstraße 21
80333 München
- im Folgenden Veranstalter genannt -

und

{{partner_company_name}},
vertreten durch den {{partner_representative}} oder anderweitig mit Vertretungsmacht ausgestattete Personen,
{{partner_address}}
- im Folgenden Partnerunternehmen genannt -

Präambel
Der Veranstalter ist ein gemeinnütziger Verein, der das Ziel verfolgt, immatrikulierte Studenten mit einem Interesse an Softwareentwicklung, maschinellem Lernen und künstlicher Intelligenz aus- und weiterzubilden. Dazu sollen die Studenten die Möglichkeit erhalten, Praxiserfahrung im Rahmen verschiedener Projekte zu sammeln.
TUM.ai e.V. führt dazu unter anderem halbjährlich einen Wettbewerb, den sogenannten Makeathon durch. Im Rahmen dieser Veranstaltung bereiten Unternehmen (Challenge-Setter) verschiedene Problemstellungen (Main- und Sidequest-Challenges) im Bereich der Künstlichen Intelligenz und des maschinellen Lernens vor, die anschließend von den Teilnehmenden gelöst werden. Zugang zum Wettbewerb hat grundsätzlich jeder, der sich fristgerecht beworben hat.
Das Partnerunternehmen verspricht sich von einer Unterstützung des Makeathons - im Folgenden Veranstaltung genannt - eine Erhöhung seines unternehmerischen Ansehens und ist an einer Einräumung von Werbemöglichkeiten interessiert. Das Partnerunternehmen hat sich daher bereit erklärt, durch finanzielle Zuwendungen die Ausrichtung dieser Veranstaltung zu unterstützen. Zu diesem Zweck vereinbaren der Veranstalter und das Partnerunternehmen - im Folgenden Parteien genannt - Folgendes:

§ 1 Veranstaltung
Der Veranstalter wird in der Zeit vom {{event_start_date}} bis einschließlich {{event_end_date}} am Veranstaltungsort in {{event_location}} einen Makeathon mit dem Titel {{event_name}} ausrichten. Dem Annex lässt sich ein vorläufiger und unverbindlicher Ablaufplan entnehmen, der das Veranstaltungsprogramm im Groben skizziert (Annex 1). Der Veranstalter behält sich Änderungen des Ablaufplans vor.

§ 2 Leistungen des Partnerunternehmens
Das Partnerunternehmen erbringt für die in § 3 genannten Gegenleistungen des Veranstalters folgende Leistungen:
a) Zahlung eines einmaligen Geldbetrags in Höhe von {{sponsoring_amount_label}} EUR (in Worten: {{sponsoring_amount_words}} Euro)[IF {{reverse_charge}} = "Yes" THEN {} ELSE { zuzüglich gesetzlich darauf anfallender Umsatzsteuer in Höhe von 19 %}]. Die Zahlung wird zwei Wochen nach Ausstellung der Rechnung fällig, die Rechnung wird nach Vertragsschluss ausgestellt. Zahlungen des Partnerunternehmens haben bargeldlos auf das folgende Konto des Veranstalters zu erfolgen: {{payment_account}}. Die Realisierung der vom Partnerunternehmen mit der Eingehung dieses Vertrages verfolgten kommunikativen Ziele bleibt auf den Vergütungsanspruch des Veranstalters ohne Einfluss.
b) Einräumung der Nutzungsrechte am eigenen Logo (siehe Annex 2) zum Zwecke der Erfüllung der unter § 3 vereinbarten Werbeleistungen des Veranstalters.

§ 3 Leistungen des Veranstalters
Der Veranstalter erbringt folgende Gegenleistungen:
a) Das Partnerunternehmen erhält das Recht, die Bezeichnung "Offizielles Partnerunternehmen des TUM.ai Makeathon" zu führen.
b) Das Logo des Partnerunternehmens wird während der Laufzeit des Vertrages auf der Website des Veranstalters und unter Umständen auf weiteren Werbematerialien betreffend der Veranstaltung integriert.
c) Das Partnerunternehmen erhält die Möglichkeit, als Challenge-Setter aufzutreten und im Rahmen dessen eine Main-Challenge (Hauptherausforderung), sowie eine Sidequest-Challenge (Nebenherausforderung) für die am Makeathon teilnehmenden Teams einzureichen.
d) Das Partnerunternehmen erhält die Möglichkeit, einen Skill-Workshop im Rahmen des Makeathons abzuhalten.
e) Dem Partnerunternehmen wird eine exklusive Präsentationsfläche (Onsite-Booth) für Einzelgespräche sowie Vernetzung mit den Makeathon-Teilnehmenden zur Verfügung gestellt.
f) Der Veranstalter verpflichtet sich, das Partnerunternehmen auf seinen Social Media Kanälen (v.a. Instagram und LinkedIn) in Zusammenhang mit dem Makeathon explizit in vier (4) einzelnen Posts zu erwähnen. Das Partnerunternehmen hat positive Kenntnis darüber, dass sich daraus nicht der Anspruch ableitet, alleine und als einziges Partnerunternehmen in den Social-Media Posts genannt zu werden. TUM.ai ist ausdrücklich nicht dazu verpflichtet, gewisse Kennzahlen, wie zum Beispiel erreichte Konten, Impressionen oder Likes, vorzuweisen. Das Partnerunternehmen ist sich bewusst, dass der Erfolg der Social Media Posts zu einem nicht unerheblichen Teil von den Algorithmen des jeweiligen sozialen Netzwerkes abhängig sind und TUM.ai jene Algorithmen nicht beeinflussen kann.
g) Der Veranstalter verpflichtet sich, dem Partnerunternehmen uneingeschränkten Zugang zu allen Lebensläufen der am Makeathon teilnehmenden Personen zu gewähren.

h) Besondere Vereinbarungen:
{{custom_terms}}

§ 4 Vertraulichkeit
(1) Die Parteien werden über den Inhalt, Umfang und die Konditionen dieses Vertrages sowie vertrauliche Informationen wie persönliche Daten absolutes Stillschweigen bewahren, auch nach Beendigung des Vertrags.
(2) Dies gilt unabhängig davon, ob sie schriftlich, elektronisch, mündlich oder in einer anderen Form übermittelt werden oder wurden. Es ist dabei unerheblich, ob diese Informationen als "vertraulich" oder "geschützt" gekennzeichnet oder anderweitig als solche bezeichnet sind oder ob ein Hinweis auf ihre Vertraulichkeit oder ihren Schutz vorliegt.
(3) Die Offenlegung gegenüber Dritten ist nur aufgrund zwingender gesetzlicher Bestimmungen oder unanfechtbarer behördlicher wie gerichtlicher Anordnung zulässig, es sei denn, die jeweils andere Partei hat vorher ausdrücklich und schriftlich eingewilligt oder Inhalt, Umfang und/oder die Konditionen dieses Vertrags sind anders als durch eine Vertragsverletzung der sich äußernden Partei bereits öffentlich bekannt geworden.
(4) Die Vertraulichkeitsverpflichtungen gelten uneingeschränkt ebenso im Verhältnis des Partnerunternehmens zu den teilnehmenden Personen, besonders im Hinblick auf die den Lebensläufen zu entnehmenden persönlichen Daten. Für etwaige Verletzungen und Schadensersatzforderungen in diesem Verhältnis haftet ausschließlich das Partnerunternehmen selbst.

§ 5 Schutzrechte

Das Partnerunternehmen hat keinerlei Rechte jedweder Art an den von den Teilnehmenden entwickelten Lösungen.

§ 6 Haftung
(1) Soweit nicht wesentliche Vertragspflichten verletzt werden, haften die Parteien einander ausschließlich für Schäden, die auf einer grob fahrlässigen oder vorsätzlichen Pflichtverletzung der jeweiligen Partei oder deren Erfüllungsgehilfen beruhen. Wesentliche Vertragspflichten sind solche Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung die jeweils andere Partei regelmäßig vertrauen darf. Die nach § 309 Nr. 7 lit. a, b BGB nicht abdingbare Haftung bleibt hiervon unberührt.
(2) Der Veranstalter haftet über die Erbringung seiner vertraglich geschuldeten Leistung hinaus nicht für eine etwaige Nichterreichung der vom Partnerunternehmen mit der Eingehung dieses Kooperationsvertrags verfolgten kommunikativen Ziele, es sei denn, der Veranstalter hat deren Realisierung durch schuldhafte Verletzung wesentlicher vertraglicher Pflichten und/oder durch vorsätzliche oder grob fahrlässige sonstige Pflichtverletzungen erschwert oder vereitelt. Zu den kommunikativen Zielen gehören zum Beispiel die Anzahl der Teilnehmenden und die dazugehörige Anzahl an Lebensläufen oder erreichte Konten auf Social Media. Zu den verfolgten Zielen gehören unter anderem der Werbeerfolg, der wirtschaftliche sowie der technische Erfolg eines Endproduktes. Ein Anspruch auf eine adäquate Lösung besteht nicht. Es ist grundsätzlich möglich, dass keiner der Teilnehmenden eine zufriedenstellende Lösung erarbeiten kann. Das damit verbundene Risiko trägt das Partnerunternehmen.

§ 7 Schriftformklausel
(1) Mündliche Nebenabreden zwischen den Parteien bestehen nicht.
(2) Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Dies gilt auch für diesen § 7 Abs. 2.

§ 8 Salvatorische Klausel
(1) Sollten einzelne Bestimmungen dieses Vertrages ganz oder teilweise unwirksam beziehungsweise undurchführbar sein oder ihre Wirksamkeit oder Durchführbarkeit später verlieren, so wird hierdurch die Gültigkeit dieses Vertrages im Übrigen nicht berührt.
(2) Im Falle einer unwirksamen Bestimmung sind die Parteien verpflichtet, diese unter billiger Berücksichtigung der beiderseitigen Interessen durch eine wirksame Bestimmung zu ersetzen, die dem mit der unwirksamen Bestimmung angestrebten wirtschaftlichen Ergebnis am nächsten kommt. Entsprechendes gilt im Falle einer Lücke, wenn die Parteien bei Abschluss dieses Vertrags den offenen Punkt bedacht hätten.

§ 9 Vertragsdauer
(1) Dieser Vertrag tritt mit der Unterzeichnung durch beide Vertragsparteien mit dem Datum der zuletzt geleisteten Unterschrift in Kraft.
(2) Dieser Vertrag endet mit der Vollendung des Makeathon. Die in § 4 vereinbarte Vertraulichkeit ist auch über das Vertragsende hinaus dauerhaft zu wahren.

§ 10 Kündigung
(1) Den Parteien steht das gesetzliche Rücktrittsrecht zu.
(2) Darüber hinaus sind die Parteien ausnahmsweise dazu berechtigt, den Vertrag ohne Einhaltung Frist zu kündigen, wenn die jeweils andere Partei schuldhaft eine ihr obliegende wesentliche vertraglich zugesicherte Leistung nicht erbringt und sie den Verstoß trotz Abmahnung mit angemessener Frist zur Abhilfe nicht beseitigt.
(3) Das Recht zur außerordentlichen Kündigung des Vertrags aus wichtigem Grund bleibt unberührt.
(4) Die Kündigung bedarf der Schriftform.

§ 11 Gerichtsstand, anwendbares Recht, Auslegung
(1) Gerichtsstand für alle sich aus oder im Zusammenhang mit diesem Vertrag ergebenen Rechtsstreitigkeiten ist ausschließlich München, Deutschland.
(2) Dieser Vertrag unterliegt hinsichtlich seines Zustandekommens und in allen seinen Wirkungen ausschließlich dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.
(3) Die Präambel ist für die Auslegung dieses Vertrags heranzuziehen.

{{partner_company_name}}
Ort, Datum: ______________________
Name: {{partner_representative}}
Unterschrift: {{partner_signature}}

TUM.ai e.V.
Ort, Datum: ______________________
Name: {{tumai_signer_name}}
Unterschrift: {{board_signature}}

Annex 1

Annex 2
$contract$,
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000005';

insert into "public"."contract_template_variables"
    ("template_id", "variable_name", "label", "data_type", "help_text", "options", "is_required", "is_multiselect", "sort_order")
values
('10000000-0000-4000-8000-000000000001', 'reverse_charge', 'Subject to reverse charge Verfahren?', 'BOOLEAN', 'Tick for partners seated outside Germany: the 19 % VAT sentence is then omitted.', null, false, false, 5),
('10000000-0000-4000-8000-000000000002', 'reverse_charge', 'Subject to reverse charge Verfahren?', 'BOOLEAN', 'Tick for partners seated outside Germany: the 19 % VAT sentence is then omitted.', null, false, false, 5),
('10000000-0000-4000-8000-000000000003', 'reverse_charge', 'Subject to reverse charge Verfahren?', 'BOOLEAN', 'Tick for partners seated outside Germany: the 19 % VAT sentence is then omitted.', null, false, false, 5),
('10000000-0000-4000-8000-000000000004', 'reverse_charge', 'Subject to reverse charge Verfahren?', 'BOOLEAN', 'Tick for partners seated outside Germany: the 19 % VAT sentence is then omitted.', null, false, false, 5),
('10000000-0000-4000-8000-000000000005', 'reverse_charge', 'Subject to reverse charge Verfahren?', 'BOOLEAN', 'Tick for partners seated outside Germany: the 19 % VAT sentence is then omitted.', null, false, false, 5),
('10000000-0000-4000-8000-000000000001', 'payment_interval', 'Payment interval', 'SELECT', null, '["einmalig","jährlich jeweils"]'::jsonb, true, false, 55),
-- TUM.ai's own receiving account, printed verbatim into § 2 and sent to the
-- partner with the contract. It is organisational payment data, never member or
-- partner bank details, so it is deliberately not one of the encrypted
-- sensitive fields (see server/src/lib/sensitiveData.ts and docs/contracts.md).
-- Templates 004/005 have carried the same variable since 20260604123000.
('10000000-0000-4000-8000-000000000002', 'payment_account', 'TUM.ai payment account', 'TEXTAREA', 'TUM.ai''s own receiving account as it should appear in § 2. Never enter partner or personal bank details here.', null, true, false, 95),
('10000000-0000-4000-8000-000000000003', 'payment_account', 'TUM.ai payment account', 'TEXTAREA', 'TUM.ai''s own receiving account as it should appear in § 2. Never enter partner or personal bank details here.', null, true, false, 75),
('10000000-0000-4000-8000-000000000004', 'payment_account', 'TUM.ai payment account', 'TEXTAREA', 'TUM.ai''s own receiving account as it should appear in § 2. Never enter partner or personal bank details here.', null, true, false, 120),
('10000000-0000-4000-8000-000000000005', 'payment_account', 'TUM.ai payment account', 'TEXTAREA', 'TUM.ai''s own receiving account as it should appear in § 2. Never enter partner or personal bank details here.', null, true, false, 100),
('10000000-0000-4000-8000-000000000003', 'contract_end_description', 'Contract end description', 'TEXT', 'Example: einem Jahr or Abschluss der Veranstaltung.', null, true, false, 85),
-- The regenerated signature blocks name the TUM.ai signer on every template.
('10000000-0000-4000-8000-000000000004', 'tumai_signer_name', 'TUM.ai signer name', 'TEXT', null, null, true, false, 160),
('10000000-0000-4000-8000-000000000005', 'tumai_signer_name', 'TUM.ai signer name', 'TEXT', null, null, true, false, 120)
on conflict ("template_id", "variable_name") do update
set
    "label" = excluded."label",
    "data_type" = excluded."data_type",
    "help_text" = excluded."help_text",
    "options" = excluded."options",
    "is_required" = excluded."is_required",
    "is_multiselect" = excluded."is_multiselect",
    "sort_order" = excluded."sort_order",
    "updated_at" = now();

-- The E-Lab wording now ends the contract with a phrase ("nach einem Jahr")
-- rather than a date, so the old required end_date field has nothing to fill.
delete from "public"."contract_template_variables"
where "template_id" = '10000000-0000-4000-8000-000000000003'
  and "variable_name" = 'end_date';

commit;
