begin;

-- The source wording for these templates was converted from data/contracts/*.docx.
-- The DOCX files stay out of git; this migration carries the deployable text.

update "public"."contract_templates"
set
    "description" = '1-year partnership contract converted from the FF sponsorship DOCX template.',
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
vertreten durch {{partner_representative}},
- im Folgenden "Partnerunternehmen" genannt -

- TUM.ai und das Partnerunternehmen zusammen die "Parteien" genannt -

Präambel

TUM.ai ist ein gemeinnütziger Verein, der das Ziel verfolgt, immatrikulierte Studierende mit einem Interesse an Softwareentwicklung, maschinellem Lernen und künstlicher Intelligenz aus- und weiterzubilden. Dazu sollen die Studierenden die Möglichkeit erhalten, Praxiserfahrung im Rahmen verschiedener Projekte und Veranstaltungen zu sammeln.

Das Partnerunternehmen ist {{partner_description}}.

TUM.ai und das Partnerunternehmen streben eine langfristige partnerschaftliche Zusammenarbeit im Bereich des Sponsorings an.

Vor diesem Hintergrund treffen die Parteien die folgende Vereinbarung:

Gegenstand des Vertrags

Das Partnerunternehmen zahlt an TUM.ai nach entsprechender Rechnungstellung durch TUM.ai jährlich jeweils bis zum {{payment_due_date}} einen Betrag in Höhe von {{package_amount_label}} (in Worten: {{package_amount_words}} Euro) zuzüglich gesetzlich geschuldeter Umsatzsteuer.

{{custom_terms}}

Als Gegenleistung erbringt TUM.ai an das Partnerunternehmen die in Anlage 1 genannten Leistungen.

Die Realisierung der vom Partnerunternehmen mit der Eingehung dieses Vertrages verfolgten Ziele bleibt auf den Vergütungsanspruch von TUM.ai ohne Einfluss, vorbehaltlich einer Haftung von TUM.ai gemäß § 4.

Die Parteien sind sich darüber einig, dass durch diesen Vertrag keine Exklusivität zugunsten des Partnerunternehmens begründet wird. TUM.ai bleibt insbesondere berechtigt, gleiche oder ähnliche Vereinbarungen mit anderen Partnern zu schließen und entsprechende Kooperationen durchzuführen.

Schutzrechte

TUM.ai gewährt dem Partnerunternehmen für die Laufzeit dieses Vertrages das einfache, nicht-ausschließliche, nicht-übertragbare, nicht-unterlizenzierbare und gebührenfreie Recht, den Namen und die Zeichen von TUM.ai in dem Umfang zu nutzen, wie dies zur Durchführung dieses Vertrags erforderlich ist.

Das Partnerunternehmen gewährt TUM.ai für die Laufzeit dieses Vertrages das einfache, nicht-ausschließliche, nicht-übertragbare, nicht-unterlizenzierbare und gebührenfreie Recht, den Namen und die Zeichen des Partnerunternehmens in dem Umfang zu nutzen, wie dies zur Durchführung dieses Vertrags erforderlich ist.

Die Parteien werden keine Handlungen vornehmen, die geeignet sind, den Ruf, den Geschäftsbetrieb oder die unter diesem Vertrag lizenzierten Rechte der jeweils anderen Partei in unangemessener Weise zu schädigen. Dies umfasst unter anderem herabwürdigende oder geschäftsschädigende Äußerungen über die andere Partei, die Nutzung der lizenzierten Rechte in einem rechtswidrigen, unethischen oder rufschädigenden Kontext oder das Bestreiten der Inhaberschaft an den lizenzierten Rechten der anderen Partei.

Vertraulichkeit

Jede Partei wird die Vertraulichen Informationen der anderen Partei vertraulich behandeln. Vertrauliche Informationen im Sinne dieses Vertrages sind Informationen, die ausdrücklich als vertraulich, geheim oder einer ähnlichen Einstufung bezeichnet werden oder aus Sicht eines objektiven Empfängers als vertraulich oder geheim anzusehen sind, einschließlich Geschäftsinformationen und -strategien, Daten von Vereinsmitgliedern und Know-how. Die Bestimmungen dieses Vertrages sind Vertrauliche Informationen beider Parteien.

Jede Partei ist berechtigt, die Vertraulichen Informationen der anderen Partei gegenüber ihren Organen, Mitarbeitern, verbundenen Unternehmen, Erfüllungsgehilfen und beruflich oder vertraglich zur Verschwiegenheit verpflichteten Beratern offenzulegen, sofern und soweit sie diese Informationen im Zusammenhang mit der Durchführung dieses Vertrags benötigen und einer angemessenen Vertraulichkeitsverpflichtung unterliegen.

Die Vertraulichkeitsverpflichtung besteht nicht, wenn und soweit die Informationen öffentlich bekannt sind, rechtmäßig von Dritten erlangt wurden, unabhängig entwickelt wurden, die offenbarende Partei der Weitergabe zugestimmt hat oder eine gesetzliche, behördliche oder gerichtliche Offenlegungspflicht besteht.

Soweit die Vertraulichen Informationen Geschäftsgeheimnisse im Sinne des Gesetzes zum Schutz von Geschäftsgeheimnissen enthalten, gilt die Vertraulichkeitsverpflichtung zeitlich so lange fort, wie die betreffende Information die Eigenschaft als Geschäftsgeheimnis besitzt. Im Übrigen endet die Vertraulichkeitsverpflichtung nach dem Ablauf von fünf (5) Jahren nach dem Ende der Vertragslaufzeit.

Haftung

TUM.ai haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie für Schäden, die auf einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung von TUM.ai, seiner gesetzlichen Vertreter oder Erfüllungsgehilfen beruhen.

Vorbehaltlich des vorstehenden Absatzes haftet TUM.ai für einfache Fahrlässigkeit nur bei Verletzung wesentlicher Vertragspflichten. In diesem Fall ist die Haftung von TUM.ai auf den vertragstypischen und bei Vertragsschluss vorhersehbaren Schaden begrenzt.

TUM.ai haftet nicht für entgangenen Gewinn und nicht für eine etwaige Nichterreichung der vom Partnerunternehmen mit der Eingehung dieses Vertrags verfolgten Ziele, soweit diese über die Erbringung der vertraglich geschuldeten Leistung von TUM.ai hinausgehen.

Laufzeit und Kündigung

Dieser Vertrag tritt am Datum der letzten Unterschrift der Parteien in Kraft und hat eine initiale Vertragslaufzeit bis zum {{end_date}}. Die Parteien werden spätestens drei (3) Monate vor Ablauf der Vertragslaufzeit in gutem Glauben Verhandlungen über eine Verlängerung dieses Vertrages führen.

Das Recht beider Parteien zur außerordentlichen Kündigung des Vertrags aus wichtigem Grund bleibt unberührt. Die Kündigung bedarf der Textform.

Alle Bestimmungen, die aufgrund ihrer Natur oder einer ausdrücklichen Vereinbarung über die Beendigung dieses Vertrags hinaus Bestand haben, bleiben auch nach der Beendigung in vollem Umfang in Kraft und wirksam.

Kontaktdaten

Alle Mitteilungen im Zusammenhang mit diesem Vertrag sind zu richten an:

Wenn sie an TUM.ai gerichtet sind:
An: TUM.ai e.V.
Zu Händen: {{tumai_contact_name}}
Adresse: Arcisstraße 21, 80333 München
E-Mail: {{tumai_contact_email}}

Wenn sie an das Partnerunternehmen gerichtet sind:
An: {{partner_company_name}}
Zu Händen: {{partner_contact_name}}
Adresse: {{partner_address}}
E-Mail: {{partner_contact_email}}

Vollständigkeit und salvatorische Klausel

Mündliche Nebenabreden zwischen den Parteien bestehen nicht. Individuelle Vereinbarungen, die nach Vertragsschluss getroffen werden, sollen von einer der Parteien unverzüglich in Textform dokumentiert und der anderen Partei übermittelt werden.

Sollten einzelne Bestimmungen dieses Vertrages ganz oder teilweise unwirksam beziehungsweise undurchführbar sein oder ihre Wirksamkeit oder Durchführbarkeit später verlieren, so wird hierdurch die Gültigkeit dieses Vertrages im Übrigen nicht berührt.

Gerichtsstand, anwendbares Recht

Gerichtsstand für alle sich aus oder im Zusammenhang mit diesem Vertrag ergebenen Rechtsstreitigkeiten ist ausschließlich München, Deutschland.

Dieser Vertrag unterliegt hinsichtlich seines Zustandekommens und in allen seinen Wirkungen ausschließlich dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.

Ausfertigungen und Form

Dieser Vertrag kann in mehreren Ausfertigungen unterzeichnet werden, die jeweils als Original gelten, aber alle zusammen nur ein und dasselbe Rechtsgeschäft darstellen. Für einen wirksamen Abschluss dieses Vertrages ist die Übermittlung einer unterzeichneten Fassung dieses Vertrags per E-Mail oder eine Unterzeichnung mittels einer elektronischen Signaturplattform ausreichend.

{{partner_company_name}}
Ort, Datum
______________________________________________________
Name
{{partner_representative}}
Unterschrift
______________________________________________________

TUM.ai e.V.
Ort, Datum
______________________________________________________
Name
{{tumai_signer_name}}
Unterschrift
______________________________________________________

Anlage 1 - Leistungen von TUM.ai

TUM.ai räumt dem Partnerunternehmen das Recht ein, während der Laufzeit des Vertrages die Bezeichnung "Offizielles Partnerunternehmen von TUM.ai" zu führen.

Das vereinbarte Sponsoringpaket umfasst:
{{package_benefits}}

Hinweis: {{package_footnote}}

Anlage 2 - Zeichen der Parteien

Zeichen von TUM.ai: nach gesonderter Bereitstellung durch TUM.ai.

Zeichen des Partnerunternehmens: nach gesonderter Bereitstellung durch das Partnerunternehmen.
$contract$,
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000001';

update "public"."contract_templates"
set
    "description" = 'One-off hackathon sponsorship contract converted from the Hackathon DOCX template.',
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

TUM.ai e.V. richtet dazu während des Semesters mehrere Hackathons in Kooperation mit Partnern aus. Im Rahmen dieser Veranstaltungen bereiten die jeweiligen Partner verschiedene Problemstellungen vor, die anschließend von den Teilnehmenden gelöst werden.

Das Partnerunternehmen verspricht sich von einer Unterstützung des {{event_name}} - im Folgenden Veranstaltung oder Hackathon genannt - eine Erhöhung seines unternehmerischen Ansehens und ist an einer Einräumung von Werbemöglichkeiten interessiert. Das Partnerunternehmen hat sich daher bereit erklärt, durch finanzielle Zuwendungen die Ausrichtung dieser Veranstaltung zu unterstützen. Zu diesem Zweck vereinbaren der Veranstalter und das Partnerunternehmen - im Folgenden Parteien genannt - Folgendes:

§ 1 Veranstaltung

Der Veranstalter wird in der Zeit vom {{event_start_date}} bis einschließlich {{event_end_date}} am Veranstaltungsort in {{event_location}} einen Hackathon mit dem Titel {{event_name}} ausrichten. Dem Annex lässt sich ein vorläufiger und unverbindlicher Ablaufplan entnehmen, der das Veranstaltungsprogramm im Groben skizziert. Der Veranstalter behält sich Änderungen des Ablaufplans vor.

§ 2 Leistungen des Partnerunternehmens

Das Partnerunternehmen erbringt für die in § 3 genannten Gegenleistungen des Veranstalters folgende Leistungen:

Zahlung eines einmaligen Geldbetrags in Höhe von {{package_amount_label}} (in Worten: {{package_amount_words}} Euro) zuzüglich gesetzlich darauf anfallender Umsatzsteuer in Höhe von 19 %. Die Zahlung wird zwei Wochen nach Ausstellung der Rechnung fällig, die Rechnung wird nach Vertragsschluss ausgestellt. Zahlungen des Partnerunternehmens haben bargeldlos auf das Konto des Veranstalters zu erfolgen. Die Realisierung der vom Partnerunternehmen mit der Eingehung dieses Vertrages verfolgten kommunikativen Ziele bleibt auf den Vergütungsanspruch des Veranstalters ohne Einfluss.

Weitere individuell vereinbarte Leistungen oder Pflichten des Partnerunternehmens:
{{custom_terms}}

§ 3 Leistungen des Veranstalters

Der Veranstalter erbringt folgende Gegenleistungen:

Das Partnerunternehmen erhält das Recht, die Bezeichnung "Offizielles Partnerunternehmen des {{event_name}}" zu verwenden.

Das Logo des Partnerunternehmens wird während der Laufzeit des Vertrages auf der Website des Veranstalters und unter Umständen auf weiteren Werbematerialien betreffend der Veranstaltung integriert.

Folgende weitere Leistungen sind im Sponsoring-Paket enthalten:
{{package_benefits}}

Add-ons / besondere Vereinbarungen:
{{addon_terms}}

§ 4 Vertraulichkeit

Die Parteien werden über den Inhalt, Umfang und die Konditionen dieses Vertrages sowie vertrauliche Informationen wie persönliche Daten absolutes Stillschweigen bewahren, auch nach Beendigung des Vertrags.

Dies gilt unabhängig davon, ob sie schriftlich, elektronisch, mündlich oder in einer anderen Form übermittelt werden oder wurden. Die Offenlegung gegenüber Dritten ist nur aufgrund zwingender gesetzlicher Bestimmungen oder unanfechtbarer behördlicher wie gerichtlicher Anordnung zulässig, es sei denn, die jeweils andere Partei hat vorher ausdrücklich und schriftlich eingewilligt.

§ 5 Datenschutz

Soweit dem Partnerunternehmen im Rahmen der Veranstaltung personenbezogene Daten, Teilnehmerlisten oder Lebensläufe zugänglich gemacht werden, verarbeitet das Partnerunternehmen diese Daten ausschließlich für die vereinbarten Zwecke und im Einklang mit den anwendbaren datenschutzrechtlichen Bestimmungen.

§ 6 Haftung

Soweit nicht wesentliche Vertragspflichten verletzt werden, haften die Parteien einander ausschließlich für Schäden, die auf einer grob fahrlässigen oder vorsätzlichen Pflichtverletzung der jeweiligen Partei oder deren Erfüllungsgehilfen beruhen. Wesentliche Vertragspflichten sind solche Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung die jeweils andere Partei regelmäßig vertrauen darf.

Der Veranstalter haftet über die Erbringung seiner vertraglich geschuldeten Leistung hinaus nicht für eine etwaige Nichterreichung der vom Partnerunternehmen mit der Eingehung dieses Kooperationsvertrags verfolgten kommunikativen Ziele.

§ 7 Schriftformklausel

Mündliche Nebenabreden zwischen den Parteien bestehen nicht. Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Dies gilt auch für diesen § 7.

§ 8 Salvatorische Klausel

Sollten einzelne Bestimmungen dieses Vertrages ganz oder teilweise unwirksam beziehungsweise undurchführbar sein oder ihre Wirksamkeit oder Durchführbarkeit später verlieren, so wird hierdurch die Gültigkeit dieses Vertrages im Übrigen nicht berührt.

§ 9 Vertragsdauer

Dieser Vertrag tritt mit der Unterzeichnung durch beide Vertragsparteien mit dem Datum der zuletzt geleisteten Unterschrift in Kraft. Dieser Vertrag endet mit der Vollendung des Hackathons. Die in § 4 vereinbarte Vertraulichkeit ist auch über das Vertragsende hinaus dauerhaft zu wahren.

§ 10 Kündigung

Den Parteien steht das gesetzliche Rücktrittsrecht zu. Darüber hinaus sind die Parteien ausnahmsweise dazu berechtigt, den Vertrag ohne Einhaltung Frist zu kündigen, wenn die jeweils andere Partei schuldhaft eine ihr obliegende wesentliche vertraglich zugesicherte Leistung nicht erbringt und sie den Verstoß trotz Abmahnung mit angemessener Frist zur Abhilfe nicht beseitigt. Das Recht zur außerordentlichen Kündigung des Vertrags aus wichtigem Grund bleibt unberührt. Die Kündigung bedarf der Schriftform.

§ 11 Gerichtsstand, anwendbares Recht, Auslegung

Gerichtsstand für alle sich aus oder im Zusammenhang mit diesem Vertrag ergebenen Rechtsstreitigkeiten ist ausschließlich München, Deutschland. Dieser Vertrag unterliegt hinsichtlich seines Zustandekommens und in allen seinen Wirkungen ausschließlich dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Die Präambel ist für die Auslegung dieses Vertrags heranzuziehen.

{{partner_company_name}}
Ort, Datum: ______________________________
Name: {{partner_representative}}
Unterschrift: ____________________________

TUM.ai e.V.
Ort, Datum: ______________________________
Name: {{tumai_signer_name}}
Unterschrift: ____________________________

Annex 1

Annex 2
$contract$,
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000002';

update "public"."contract_templates"
set
    "description" = 'AI E-Lab jury-seat sponsorship contract converted from the AI E-Lab DOCX template.',
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

Der Veranstalter wird in der Zeit vom {{event_start_date}} bis einschließlich {{event_end_date}} am Veranstaltungsort in {{event_location}} das AI E-Lab ausrichten. Dem Annex lässt sich ein vorläufiger und unverbindlicher Ablaufplan entnehmen, der das Veranstaltungsprogramm im Groben skizziert. Der Veranstalter behält sich Änderungen des Ablaufplans vor.

§ 2 Leistungen des Partnerunternehmens

Das Partnerunternehmen erbringt für die in § 3 genannten Gegenleistungen des Veranstalters folgende Leistungen:

Zahlung eines einmaligen Geldbetrags in Höhe von {{package_amount_label}} (in Worten: {{package_amount_words}} Euro) zuzüglich gesetzlich darauf anfallender Umsatzsteuer in Höhe von 19 %. Die Zahlung wird zwei Wochen nach Ausstellung der Rechnung fällig, die Rechnung wird nach Vertragsschluss ausgestellt. Zahlungen des Partnerunternehmens haben bargeldlos auf das Konto des Veranstalters zu erfolgen. Die Realisierung der vom Partnerunternehmen mit der Eingehung dieses Vertrages verfolgten kommunikativen Ziele bleibt auf den Vergütungsanspruch des Veranstalters ohne Einfluss.

§ 3 Leistungen des Veranstalters

Der Veranstalter erbringt folgende Gegenleistungen:

Das Partnerunternehmen erhält das Recht, die Bezeichnung "Offizielles Partnerunternehmen des AI Entrepreneurship Lab" zu verwenden.

Das Logo des Partnerunternehmens wird während der Laufzeit des Vertrages auf der Website des Veranstalters und unter Umständen auf weiteren Werbematerialien betreffend der Veranstaltung integriert.

Folgende weitere Leistungen sind im Sponsoring-Paket enthalten:
{{package_benefits}}

Besondere Vereinbarungen:
{{custom_terms}}

§ 4 Vertraulichkeit

Die Parteien werden über den Inhalt, Umfang und die Konditionen dieses Vertrages sowie vertrauliche Informationen wie persönliche Daten absolutes Stillschweigen bewahren, auch nach Beendigung des Vertrags.

Dies gilt unabhängig davon, ob sie schriftlich, elektronisch, mündlich oder in einer anderen Form übermittelt werden oder wurden. Die Offenlegung gegenüber Dritten ist nur aufgrund zwingender gesetzlicher Bestimmungen oder unanfechtbarer behördlicher wie gerichtlicher Anordnung zulässig, es sei denn, die jeweils andere Partei hat vorher ausdrücklich und schriftlich eingewilligt.

§ 5 Haftung

Soweit nicht wesentliche Vertragspflichten verletzt werden, haften die Parteien einander ausschließlich für Schäden, die auf einer grob fahrlässigen oder vorsätzlichen Pflichtverletzung der jeweiligen Partei oder deren Erfüllungsgehilfen beruhen. Wesentliche Vertragspflichten sind solche Pflichten, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung die jeweils andere Partei regelmäßig vertrauen darf.

Der Veranstalter haftet über die Erbringung seiner vertraglich geschuldeten Leistung hinaus nicht für eine etwaige Nichterreichung der vom Partnerunternehmen mit der Eingehung dieses Kooperationsvertrags verfolgten kommunikativen Ziele.

§ 6 Schriftformklausel

Mündliche Nebenabreden zwischen den Parteien bestehen nicht. Änderungen und Ergänzungen dieses Vertrages bedürfen der Schriftform. Dies gilt auch für diesen § 6.

§ 7 Salvatorische Klausel

Sollten einzelne Bestimmungen dieses Vertrages ganz oder teilweise unwirksam beziehungsweise undurchführbar sein oder ihre Wirksamkeit oder Durchführbarkeit später verlieren, so wird hierdurch die Gültigkeit dieses Vertrages im Übrigen nicht berührt.

§ 8 Vertragsdauer

Dieser Vertrag tritt mit der Unterzeichnung durch beide Vertragsparteien mit dem Datum der zuletzt geleisteten Unterschrift in Kraft. Dieser Vertrag endet entweder automatisch nach {{end_date}} oder durch Kündigung. Die in § 4 vereinbarte Vertraulichkeit ist auch über das Vertragsende hinaus dauerhaft zu wahren.

§ 9 Kündigung

Den Parteien steht das gesetzliche Rücktrittsrecht zu. Darüber hinaus sind die Parteien ausnahmsweise dazu berechtigt, den Vertrag ohne Einhaltung Frist zu kündigen, wenn die jeweils andere Partei schuldhaft eine ihr obliegende wesentliche vertraglich zugesicherte Leistung nicht erbringt und sie den Verstoß trotz Abmahnung mit angemessener Frist zur Abhilfe nicht beseitigt. Das Recht zur außerordentlichen Kündigung des Vertrags aus wichtigem Grund bleibt unberührt. Die Kündigung bedarf der Schriftform.

§ 10 Gerichtsstand, anwendbares Recht, Auslegung

Gerichtsstand für alle sich aus oder im Zusammenhang mit diesem Vertrag ergebenen Rechtsstreitigkeiten ist ausschließlich München, Deutschland. Dieser Vertrag unterliegt hinsichtlich seines Zustandekommens und in allen seinen Wirkungen ausschließlich dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Die Präambel ist für die Auslegung dieses Vertrags heranzuziehen.

{{partner_company_name}}
Ort, Datum: ______________________________
Name: {{partner_representative}}
Unterschrift: ____________________________

TUM.ai e.V.
Ort, Datum: ______________________________
Name: {{tumai_signer_name}}
Unterschrift: ____________________________

Annex 1

Annex 2
$contract$,
    "updated_at" = now()
where "id" = '10000000-0000-4000-8000-000000000003';

commit;
