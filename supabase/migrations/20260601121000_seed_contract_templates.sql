begin;

insert into "public"."contract_templates" ("id", "name", "description", "contract_text", "is_active")
values
(
    '10000000-0000-4000-8000-000000000001',
    'Long-Term Partnership',
    '1-year partnership contract based on the FF sponsorship template.',
    $contract$
- Bei diesem Dokument handelt es sich um einen Entwurf, welcher keine vertraglichen oder vorvertraglichen Rechte und Pflichten begruendet -

SPONSORINGVERTRAG

zwischen

TUM.ai e.V., Arcisstrasse 21, 80333 Muenchen, vertreten durch den Vorstand,
- im Folgenden "TUM.ai" genannt -

und

{{partner_company_name}}
{{partner_address}}
vertreten durch {{partner_representative}},
- im Folgenden "Partnerunternehmen" genannt -

TUM.ai und das Partnerunternehmen zusammen die "Parteien".

Praeambel

TUM.ai ist ein gemeinnuetziger Verein, der immatrikulierte Studierende mit Interesse an Softwareentwicklung, maschinellem Lernen und kuenstlicher Intelligenz aus- und weiterbildet. Das Partnerunternehmen ist {{partner_description}}. Die Parteien streben eine langfristige partnerschaftliche Zusammenarbeit im Bereich des Sponsorings an.

1. Gegenstand des Vertrags

Das Partnerunternehmen zahlt an TUM.ai nach entsprechender Rechnungsstellung durch TUM.ai jaehrlich bis zum {{payment_due_date}} einen Betrag in Hoehe von {{package_amount_label}} (in Worten: {{package_amount_words}} Euro) zuzueglich gesetzlich geschuldeter Umsatzsteuer.

Als Gegenleistung erbringt TUM.ai an das Partnerunternehmen die folgenden Leistungen:
{{package_benefits}}

Add-ons / besondere Vereinbarungen:
{{custom_terms}}

Hinweis: {{package_footnote}}

Die Realisierung der vom Partnerunternehmen mit diesem Vertrag verfolgten Ziele bleibt auf den Verguetungsanspruch von TUM.ai ohne Einfluss. Durch diesen Vertrag wird keine Exklusivitaet zugunsten des Partnerunternehmens begruendet.

2. Schutzrechte

TUM.ai gewaehrt dem Partnerunternehmen fuer die Laufzeit dieses Vertrages das einfache, nicht-ausschliessliche, nicht-uebertragbare, nicht-unterlizenzierbare und gebuehrenfreie Recht, den Namen und die Zeichen von TUM.ai in dem Umfang zu nutzen, wie dies zur Durchfuehrung dieses Vertrags erforderlich ist. Das Partnerunternehmen gewaehrt TUM.ai entsprechend das Recht, Namen und Zeichen des Partnerunternehmens zur Durchfuehrung dieses Vertrags zu nutzen.

3. Vertraulichkeit

Jede Partei wird vertrauliche Informationen der anderen Partei vertraulich behandeln. Vertrauliche Informationen sind insbesondere Geschaeftsinformationen und -strategien, Daten von Vereinsmitgliedern, Know-how sowie die Bedingungen dieses Vertrags. Die Vertraulichkeitsverpflichtung besteht nach Vertragsende fuer fuenf (5) Jahre fort; fuer Geschaeftsgeheimnisse gilt sie so lange, wie die Information ein Geschaeftsgeheimnis bleibt.

4. Haftung

TUM.ai haftet unbeschraenkt fuer Schaeden aus der Verletzung des Lebens, des Koerpers oder der Gesundheit sowie fuer vorsatzliche oder grob fahrlaessige Pflichtverletzungen. Im Uebrigen haftet TUM.ai fuer einfache Fahrlaessigkeit nur bei Verletzung wesentlicher Vertragspflichten und begrenzt auf den vertragstypischen, vorhersehbaren Schaden.

5. Laufzeit und Kuendigung

Dieser Vertrag tritt mit der letzten Unterschrift in Kraft und laeuft vom {{start_date}} bis zum {{end_date}}. Das Recht beider Parteien zur ausserordentlichen Kuendigung aus wichtigem Grund bleibt unberuehrt. Die Kuendigung bedarf der Textform.

6. Kontaktdaten

Mitteilungen an TUM.ai:
Zu Haenden: {{tumai_contact_name}}
E-Mail: {{tumai_contact_email}}

Mitteilungen an das Partnerunternehmen:
Zu Haenden: {{partner_contact_name}}
E-Mail: {{partner_contact_email}}

7. Schlussbestimmungen

Muendliche Nebenabreden bestehen nicht. Gerichtsstand fuer alle Streitigkeiten ist Muenchen. Dieser Vertrag unterliegt dem Recht der Bundesrepublik Deutschland.

Unterschriften

{{partner_company_name}}
Ort, Datum: ______________________________
Name: {{partner_representative}}
Unterschrift: ____________________________

TUM.ai e.V.
Ort, Datum: ______________________________
Name: {{tumai_signer_name}}
Unterschrift: ____________________________
$contract$,
    true
),
(
    '10000000-0000-4000-8000-000000000002',
    'EHL Hackathon Pass',
    'One-off hackathon sponsorship contract based on the hackathon template.',
    $contract$
KOOPERATIONSVERTRAG

zwischen

TUM.ai e.V., vertreten durch den Vorstand, Arcisstrasse 21, 80333 Muenchen,
- im Folgenden Veranstalter genannt -

und

{{partner_company_name}}, vertreten durch {{partner_representative}},
{{partner_address}},
- im Folgenden Partnerunternehmen genannt -

Praeambel

Der Veranstalter ist ein gemeinnuetziger Verein, der Studierenden Praxiserfahrung in Softwareentwicklung, maschinellem Lernen und kuenstlicher Intelligenz ermoeglicht. TUM.ai richtet dazu Hackathons in Kooperation mit Partnern aus. Das Partnerunternehmen unterstuetzt {{event_name}} und erhaelt hierfuer Werbe- und Kooperationsleistungen.

1. Veranstaltung

Der Veranstalter richtet in der Zeit vom {{event_start_date}} bis einschliesslich {{event_end_date}} am Veranstaltungsort in {{event_location}} einen Hackathon mit dem Titel {{event_name}} aus.

2. Leistungen des Partnerunternehmens

Das Partnerunternehmen zahlt einmalig {{package_amount_label}} (in Worten: {{package_amount_words}} Euro) zuzueglich gesetzlicher Umsatzsteuer. Die Zahlung wird zwei Wochen nach Ausstellung der Rechnung faellig.

Weitere Leistungen oder Pflichten des Partnerunternehmens:
{{custom_terms}}

3. Leistungen des Veranstalters

Das Partnerunternehmen erhaelt das Recht, die Bezeichnung "Offizielles Partnerunternehmen des {{event_name}}" zu verwenden. Der Veranstalter erbringt folgende Sponsoring-Leistungen:
{{package_benefits}}

Add-ons / besondere Vereinbarungen:
{{addon_terms}}

4. Vertraulichkeit und Datenschutz

Die Parteien werden ueber Inhalt, Umfang und Konditionen dieses Vertrages sowie vertrauliche Informationen Stillschweigen bewahren. Vertraulichkeit gilt insbesondere fuer persoenliche Daten und Lebenslaeufe der Teilnehmenden.

5. Schutzrechte

Das Partnerunternehmen hat keine Rechte an den von Teilnehmenden entwickelten Loesungen, soweit nichts Anderweitiges individuell vereinbart wurde.

6. Haftung

Die Parteien haften einander, soweit keine wesentlichen Vertragspflichten verletzt werden, nur fuer Vorsatz und grobe Fahrlaessigkeit. TUM.ai schuldet keinen bestimmten Werbe-, Teilnehmer- oder Projekterfolg.

7. Vertragsdauer und Kuendigung

Dieser Vertrag tritt mit der letzten Unterschrift in Kraft und endet mit Vollendung des Hackathons. Ausserordentliche Kuendigungsrechte bleiben unberuehrt.

8. Schlussbestimmungen

Muendliche Nebenabreden bestehen nicht. Gerichtsstand ist Muenchen. Es gilt deutsches Recht.

Unterschriften

{{partner_company_name}}
Ort, Datum: ______________________________
Name: {{partner_representative}}
Unterschrift: ____________________________

TUM.ai e.V.
Ort, Datum: ______________________________
Name: {{tumai_signer_name}}
Unterschrift: ____________________________
$contract$,
    true
),
(
    '10000000-0000-4000-8000-000000000003',
    'E-Lab Jury Seat',
    'AI E-Lab jury-seat sponsorship contract.',
    $contract$
KOOPERATIONSVERTRAG

zwischen

TUM.ai e.V., vertreten durch den Vorstand, Arcisstrasse 21, 80333 Muenchen,
- im Folgenden Veranstalter genannt -

und

{{partner_company_name}}, vertreten durch {{partner_representative}},
{{partner_address}},
- im Folgenden Partnerunternehmen genannt -

Praeambel

TUM.ai betreibt das AI Entrepreneurship Lab (AI E-Lab), ein Startup-Inkubator-Programm von der Ideenfindung bis zum Pitch. Das Partnerunternehmen unterstuetzt das AI E-Lab und erhaelt die nachfolgend vereinbarten Leistungen.

1. Veranstaltung

Der Veranstalter richtet das AI E-Lab im Zeitraum vom {{event_start_date}} bis {{event_end_date}} in {{event_location}} aus.

2. Leistungen des Partnerunternehmens

Das Partnerunternehmen zahlt einmalig {{package_amount_label}} (in Worten: {{package_amount_words}} Euro) zuzueglich gesetzlicher Umsatzsteuer. Die Zahlung wird zwei Wochen nach Ausstellung der Rechnung faellig.

3. Leistungen des Veranstalters

Das Partnerunternehmen erhaelt das Recht, die Bezeichnung "Offizielles Partnerunternehmen des AI Entrepreneurship Lab" zu verwenden. Folgende Leistungen sind umfasst:
{{package_benefits}}

Besondere Vereinbarungen:
{{custom_terms}}

4. Vertraulichkeit

Die Parteien werden ueber Inhalt, Umfang und Konditionen dieses Vertrages sowie vertrauliche Informationen Stillschweigen bewahren.

5. Haftung

Die Parteien haften einander, soweit keine wesentlichen Vertragspflichten verletzt werden, nur fuer Vorsatz und grobe Fahrlaessigkeit. TUM.ai schuldet keinen bestimmten kommunikativen oder wirtschaftlichen Erfolg.

6. Vertragsdauer und Kuendigung

Dieser Vertrag tritt mit der letzten Unterschrift in Kraft und endet automatisch nach {{end_date}} oder durch Kuendigung. Ausserordentliche Kuendigungsrechte bleiben unberuehrt.

7. Schlussbestimmungen

Muendliche Nebenabreden bestehen nicht. Gerichtsstand ist Muenchen. Es gilt deutsches Recht.

Unterschriften

{{partner_company_name}}
Ort, Datum: ______________________________
Name: {{partner_representative}}
Unterschrift: ____________________________

TUM.ai e.V.
Ort, Datum: ______________________________
Name: {{tumai_signer_name}}
Unterschrift: ____________________________
$contract$,
    true
)
on conflict ("id") do update
set
    "name" = excluded."name",
    "description" = excluded."description",
    "contract_text" = excluded."contract_text",
    "is_active" = excluded."is_active",
    "updated_at" = now();

delete from "public"."contract_template_variables"
where "template_id" in (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003'
);

insert into "public"."contract_template_variables"
    ("template_id", "variable_name", "label", "data_type", "help_text", "options", "is_required", "is_multiselect", "sort_order")
values
('10000000-0000-4000-8000-000000000001', 'partner_company_name', 'Partner company name', 'TEXT', null, null, true, false, 10),
('10000000-0000-4000-8000-000000000001', 'partner_address', 'Partner address', 'TEXTAREA', null, null, true, false, 20),
('10000000-0000-4000-8000-000000000001', 'partner_representative', 'Partner representative', 'TEXT', null, null, true, false, 30),
('10000000-0000-4000-8000-000000000001', 'partner_description', 'Partner description', 'TEXTAREA', null, null, true, false, 40),
('10000000-0000-4000-8000-000000000001', 'sponsoring_package', 'Partnership package', 'SELECT', null, '["long_term_bronze","long_term_silver","long_term_gold","long_term_principal"]'::jsonb, true, false, 50),
('10000000-0000-4000-8000-000000000001', 'payment_due_date', 'Annual payment due date', 'DATE', null, null, true, false, 60),
('10000000-0000-4000-8000-000000000001', 'start_date', 'Start date', 'DATE', null, null, true, false, 70),
('10000000-0000-4000-8000-000000000001', 'end_date', 'End date', 'DATE', null, null, true, false, 80),
('10000000-0000-4000-8000-000000000001', 'custom_terms', 'Add-ons / special terms', 'TEXTAREA', null, null, false, false, 90),
('10000000-0000-4000-8000-000000000001', 'tumai_contact_name', 'TUM.ai contact name', 'TEXT', null, null, true, false, 100),
('10000000-0000-4000-8000-000000000001', 'tumai_contact_email', 'TUM.ai contact email', 'TEXT', null, null, true, false, 110),
('10000000-0000-4000-8000-000000000001', 'partner_contact_name', 'Partner contact name', 'TEXT', null, null, true, false, 120),
('10000000-0000-4000-8000-000000000001', 'partner_contact_email', 'Partner contact email', 'TEXT', null, null, true, false, 130),
('10000000-0000-4000-8000-000000000001', 'tumai_signer_name', 'TUM.ai signer name', 'TEXT', null, null, true, false, 140),

('10000000-0000-4000-8000-000000000002', 'partner_company_name', 'Partner company name', 'TEXT', null, null, true, false, 10),
('10000000-0000-4000-8000-000000000002', 'partner_address', 'Partner address', 'TEXTAREA', null, null, true, false, 20),
('10000000-0000-4000-8000-000000000002', 'partner_representative', 'Partner representative', 'TEXT', null, null, true, false, 30),
('10000000-0000-4000-8000-000000000002', 'event_name', 'Event name', 'TEXT', null, null, true, false, 40),
('10000000-0000-4000-8000-000000000002', 'event_start_date', 'Event start date', 'DATE', null, null, true, false, 50),
('10000000-0000-4000-8000-000000000002', 'event_end_date', 'Event end date', 'DATE', null, null, true, false, 60),
('10000000-0000-4000-8000-000000000002', 'event_location', 'Event location', 'TEXT', null, null, true, false, 70),
('10000000-0000-4000-8000-000000000002', 'sponsoring_package', 'Hackathon package', 'SELECT', null, '["ehl_bronze","ehl_silver","ehl_gold","ehl_platinum"]'::jsonb, true, false, 80),
('10000000-0000-4000-8000-000000000002', 'addon_terms', 'Add-ons', 'TEXTAREA', 'Examples: catering sponsorship, ceremony job posting, workshop slot.', null, false, false, 90),
('10000000-0000-4000-8000-000000000002', 'custom_terms', 'Partner obligations / special terms', 'TEXTAREA', null, null, false, false, 100),
('10000000-0000-4000-8000-000000000002', 'tumai_signer_name', 'TUM.ai signer name', 'TEXT', null, null, true, false, 110),

('10000000-0000-4000-8000-000000000003', 'partner_company_name', 'Partner company name', 'TEXT', null, null, true, false, 10),
('10000000-0000-4000-8000-000000000003', 'partner_address', 'Partner address', 'TEXTAREA', null, null, true, false, 20),
('10000000-0000-4000-8000-000000000003', 'partner_representative', 'Partner representative', 'TEXT', null, null, true, false, 30),
('10000000-0000-4000-8000-000000000003', 'event_start_date', 'Program start date', 'DATE', null, null, true, false, 40),
('10000000-0000-4000-8000-000000000003', 'event_end_date', 'Program end date', 'DATE', null, null, true, false, 50),
('10000000-0000-4000-8000-000000000003', 'event_location', 'Event location', 'TEXT', null, null, true, false, 60),
('10000000-0000-4000-8000-000000000003', 'sponsoring_package', 'Jury seat package', 'SELECT', null, '["e_lab_midterm","e_lab_final"]'::jsonb, true, false, 70),
('10000000-0000-4000-8000-000000000003', 'end_date', 'Contract end date', 'DATE', null, null, true, false, 80),
('10000000-0000-4000-8000-000000000003', 'custom_terms', 'Special terms', 'TEXTAREA', null, null, false, false, 90),
('10000000-0000-4000-8000-000000000003', 'tumai_signer_name', 'TUM.ai signer name', 'TEXT', null, null, true, false, 100);

commit;
