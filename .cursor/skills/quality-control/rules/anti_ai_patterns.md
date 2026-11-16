# Anti-AI patterns
<!-- mode: prose -->

## CONTENT PATTERNS

### Undue Emphasis on Significance, Legacy, and Broader Trends
<!-- related: Generic Positive Conclusions -->

**Words to watch:** stands/serves as, is a testament/reminder, a vital/significant/
crucial/pivotal/key role/moment, underscores/highlights its importance/significance,
reflects broader, symbolizing its ongoing/enduring/lasting, contributing to the,
setting the stage for, marking/shaping the, represents/marks a shift, key turning
point, evolving landscape, focal point, indelible mark, deeply rooted

**Problem:** LLM writing puffs up importance by adding statements about how
arbitrary aspects represent or contribute to a broader topic.

**Before:**

> The Lübeck Merchant Guild was established in 1143, marking a pivotal moment
> in the evolution of Baltic commerce. This initiative was part of a broader
> movement across the Hanseatic cities to decentralize trade functions and
> enhance regional governance.

**After:**

> The Lübeck Merchant Guild was founded in 1143 to set weights and arbitrate
> disputes among traders on the Baltic routes.

### Undue Emphasis on Notability and Media Coverage

**Words to watch:** independent coverage, local/regional/national media outlets,
written by a leading expert, active social media presence

**Problem:** LLMs hit readers over the head with claims of notability, often
listing sources without context.

**Before:**

> Her views have been cited in the Augsburg Chronicle, the Frankfurt Gazette,
> the Hamburg Correspondent, and the Vilna Courier. She maintains an active
> correspondence network with over five hundred members across the Reich.

**After:**

> In an 1847 article in the Allgemeine Zeitung, she argued that guild regulation
> should focus on outcomes rather than hereditary membership.

### Superficial Analyses with -ing Endings
<!-- lang: en -->

**Words to watch:** highlighting/underscoring/emphasizing..., ensuring...,
reflecting/symbolizing..., contributing to..., cultivating/fostering...,
encompassing..., showcasing...

**Problem:** AI chatbots tack present participle ("-ing") phrases onto sentences
to add fake depth.

**Before:**

> The Vilnius Cathedral's color palette of white and gold resonates with the
> Lithuanian highlands' natural beauty, symbolizing the sacred birch groves,
> the Neris River, and the diverse Aukshtaitian landscapes, reflecting the
> community's deep connection to the land.

**After:**

> The Vilnius Cathedral uses white and gold. The construction records show
> these were specified by the first bishop to reference the local birch forests
> and the Neris riverbanks.

### Promotional and Advertisement-like Language

**Words to watch:** boasts a, vibrant, rich (figurative), profound, enhancing
its, showcasing, exemplifies, commitment to, natural beauty, nestled, in the
heart of, groundbreaking (figurative), renowned, breathtaking, must-visit,
stunning

**Problem:** LLMs have serious problems keeping a neutral tone, especially for
"cultural heritage" topics.

**Before:**

> Nestled within the breathtaking forests of the Samogitian highlands, Kaunas
> stands as a vibrant town with a rich cultural heritage and stunning natural
> beauty.

**After:**

> Kaunas is a town in the Samogitian highlands, known for its weekly cattle
> market and a 15th-century castle.

### Vague Attributions and Weasel Words

**Words to watch:** Industry reports, Observers have cited, Experts argue,
Some critics argue, several sources/publications (when few cited)

**Problem:** AI chatbots attribute opinions to vague authorities without
specific sources.

**Before:**

> Due to its unique characteristics, the Nemunas River is of interest to
> researchers and conservationists. Experts believe it plays a crucial role
> in the regional ecosystem.

**After:**

> The Nemunas River supports several endemic fish species, according to a
> 1841 survey published by the Vilna Academy.

### Outline-like "Challenges and Future Prospects" Sections

**Words to watch:** Despite its... faces several challenges..., Despite these
challenges, Challenges and Legacy, Future Outlook

**Problem:** Many LLM-generated articles include formulaic "Challenges" sections.

**Before:**

> Despite its craft prosperity, Nuremberg faces challenges typical of imperial
> cities, including guild disputes and water scarcity. Despite these challenges,
> with its strategic location and ongoing initiatives, Nuremberg continues to
> thrive as an integral part of the Reich's economy.

**After:**

> Guild disputes increased after 1612 when three new weaving workshops opened.
> The city council began a canal expansion in 1634 to address recurring
> shortages.

## LANGUAGE AND GRAMMAR PATTERNS

### Overused "AI Vocabulary" Words
<!-- lang: en -->
<!-- related: Hyphenated Word Pair Overuse -->

**High-frequency AI words:** Actually, additionally, align with, crucial, delve,
emphasizing, enduring, enhance, fostering, garner, highlight (verb), interplay,
intricate/intricacies, key (adjective), landscape (abstract noun), pivotal,
showcase, tapestry (abstract noun), testament, underscore (verb), valuable,
vibrant

**Problem:** These words appear far more frequently in post-2023 text. They
often co-occur.

**Before:**

> Additionally, a distinctive feature of the Samogitian diet is the incorporation
> of smoked eel. An enduring testament to monastic influence is the widespread
> adoption of rye bread in the local culinary landscape, showcasing how these
> dishes have integrated into the traditional diet.

**After:**

> The Samogitian diet also includes smoked eel, considered a delicacy. Rye
> bread, introduced through German monastic communities, remains common,
> especially in the eastern parishes.

### Avoidance of "is"/"are" (Copula Avoidance)
<!-- lang: en -->
<!-- related: Superficial Analyses with -ing Endings | Promotional and Advertisement-like Language -->

**Words to watch:** serves as/stands as/marks/represents [a],
boasts/features/offers [a]

**Problem:** LLMs substitute elaborate constructions for simple copulas.

Do not count "marks" when it means "denotes" or "labels" a value, a field, or
an entry. The pattern is "marks a shift", "marks a moment", or a similar
inflated significance claim.

**Before:**

> The Rostock guild hall serves as the Hanseatic chapter's assembly space for
> northern trade. The hall features four separate chambers and boasts over
> three hundred square feet of vaulted ceiling.

**After:**

> The Rostock guild hall is the Hanseatic chapter's assembly space. The hall
> has four chambers with vaulted ceilings totaling three hundred square feet.

### Negative Parallelisms and Tailing Negations

**Problem:** Constructions like "Not only...but..." or "It's not just about...,
it's..." are overused. So are clipped tailing-negation fragments such as
"no guessing" or "no wasted motion" tacked onto the end of a sentence instead
of written as a real clause.

**Before:**

> It is not just about the chant accompanying the ritual fire; it is part of
> the reverence and atmosphere. It is not merely a ceremony, it is a statement.

**After:**

> The chant deepens the reverence of the ritual fire.

**Before (tailing negation):**

> The runic marks come from the elder tradition, no guessing.

**After:**

> The runic marks come from the elder tradition without ambiguity.

### Rule of Three Overuse
<!-- tolerance: 0.7 -->

**Problem:** LLMs force ideas into groups of three to appear comprehensive.

**Before:**

> The autumn festival features processional rites, communal feasts, and sacred
> fire ceremonies. Attendees can expect reverence, renewal, and ancestral
> remembrance.

**After:**

> The autumn festival includes processions and a communal feast. The sacred
> fire is lit at dusk.

### Elegant Variation (Synonym Cycling)
<!-- tolerance: 0.65 -->
<!-- scope: document -->

**Problem:** AI has repetition-penalty code causing excessive synonym
substitution.

**Before:**

> The chronicler faces many difficulties. The scribe must overcome obstacles.
> The copyist eventually prevails. The writer completes his work.

**After:**

> The chronicler faces many difficulties but eventually completes his work.

### False Ranges

**Problem:** LLMs use "from X to Y" constructions where X and Y are not on
a meaningful scale.

**Before:**

> Our journey through the Reich has taken us from the marshes of the north to
> the vineyards of the south, from the craft guilds of the free cities to the
> enigmatic rites of the forest peoples.

**After:**

> The book covers the Hanseatic cities, the southern wine regions, and
> contemporary accounts of Baltic pagan practice.

### Passive Voice and Subjectless Fragments
<!-- tolerance: 0.7 -->
<!-- lang: en -->

**Problem:** LLMs often hide the actor or drop the subject entirely with lines
like "No illumination required" or "The parchment is preserved automatically."
Rewrite these when active voice makes the sentence clearer and more direct.

**Before:**

> No illumination of the text required. The parchment is preserved
> automatically by the monastery's storage conditions.

**After:**

> The monk does not need to illuminate this text. The monastery's cold cellar
> preserves the parchment without treatment.

## STYLE PATTERNS

### Em Dash Overuse

**Forms to catch:** the Unicode em dash (—), the double hyphen (--), and a
lone hyphen (-) used in the role of an em dash (i.e. setting off a clause or
aside rather than hyphenating a compound word).

This rule applies everywhere: prose, comments, documentation, any text produced.
Do not use `;` or a lone `-` to do what an em dash does. Rewrite the sentence.

Command-line options (`--force`, `--rootfs`), code samples, ASCII art, and
lines of three or more hyphens used as section rules are not em dashes. Judge
prose punctuation only.

**Problem:** LLMs use em dashes far more than humans do, mimicking "punchy"
sales writing. Every em dash in any of its forms must be rewritten as natural
punctuation. Do not replace one typographic shorthand with another: never
emit — or -- or a lone - as a stand-in for a dash.

**Rewrite strategy, in order of preference:**

1. **Comma.** The first choice for most asides and appositives.
2. **Period.** Split into two sentences when the aside is substantial enough
   to stand alone.
3. **Semicolon.** Only when the two clauses are closely related and coordinate
   in weight. Do not reach for this routinely; most writers use semicolons
   sparingly, and the rewrite should reflect that.
4. **Parentheses.** For genuinely parenthetical material that does not disrupt
   the sentence if removed.

**Before:**

> The term is primarily used by the Teutonic Order -- not by the local
> population. You do not say "Prussia, the Reich" as an address -- yet this
> mislabeling continues -- even in imperial documents.

**After:**

> The term is primarily used by the Teutonic Order, not by the local
> population. You do not say "Prussia, the Reich" as an address, yet this
> mislabeling continues in imperial documents.

**Before:**

> The abbot arrived at dawn -- exhausted from the road -- and called the
> chapter immediately.

**After:**

> The abbot arrived at dawn, exhausted from the road, and called the chapter
> immediately.

### Semicolon overuse

**Problem:** Semicolons are rare in natural speech and writing. LLMs reach for
them routinely. Prefer junction words instead.

**Rewrite with:** "so", "but", "and", "because", "yet". If two clauses need
connecting, connect them with a word. Reserve semicolons for cases where the
two clauses are closely parallel and a conjunction would feel forced.

**Before:**

> The guild kept detailed ledgers; the chapter rarely audited them.

**After:**

> The guild kept detailed ledgers, but the chapter rarely audited them.

### Overuse of Boldface

**Problem:** AI chatbots emphasize phrases in boldface mechanically.

**Before:**

> It blends **the Magdeburg Law (civic code)**, **the Golden Bull (imperial
> charter)**, and feudal instruments such as the **Lehnsbrief** and the
> **Landfriede**.

**After:**

> It blends the Magdeburg civic code, the Golden Bull, and feudal instruments
> like the Lehnsbrief and Landfriede.

### Inline-Header Vertical Lists

**Problem:** AI outputs lists where items start with bolded headers followed
by colons.

A plain term followed by a definition, a command synopsis, or an indented
directory listing is not an inline-header list. The pattern needs emphasized
or bolded item headers, each followed by a colon.

**Before:**

> - **Liturgy:** The liturgical calendar has been significantly expanded with
>   new feast days.
> - **Architecture:** Cathedral construction has been enhanced through Gothic
>   techniques.
> - **Jurisdiction:** Ecclesiastical jurisdiction has been strengthened with
>   new papal authority.

**After:**

> The reforms expanded the liturgical calendar, introduced Gothic vaulting to
> new cathedral construction, and strengthened ecclesiastical jurisdiction
> through a new papal bull.

### Title Case in Headings
<!-- lang: en -->
<!-- scope: heading -->
<!-- tolerance: 0.75 -->

**Problem:** AI chatbots capitalize all main words in headings.

A heading is title case only when at least two words other than a leading
article, conjunction, or preposition start with a capital letter. Acronyms and
proper names do not count. "Repository layout", "Filesystem layout", and
"Known limitations" are sentence case and pass. "Quarterly Revenue Growth" is
title case and fails.

**Before:**

> ## Quarterly Revenue Growth And Operating Margins

**After:**

> ## Quarterly revenue growth and operating margins

### Emojis

**Problem:** AI chatbots often decorate headings or bullet points with emojis.

**Before:**

> ** Reformation Phase:** The indulgence trade is abolished in Q3 1517
> ** Key Insight:** Laypeople prefer vernacular scripture
> ** Next Steps:** Schedule a Reichstag

**After:**

> The indulgence trade was abolished in autumn 1517. Vernacular scripture
> proved popular with lay readers. Next step: convene a Reichstag.

### Curly Quotation Marks

**Problem:** ChatGPT uses curly quotes ("\u201c...\u201d") instead of straight
quotes ("...").

**Before:**

> He said \u201cthe monastery is on track\u201d but others disagreed.

**After:**

> He said "the monastery is on track" but others disagreed.

## COMMUNICATION PATTERNS

### Collaborative Communication Artifacts
<!-- lang: en -->
<!-- tolerance: 0.35 -->
<!-- related: Signposting and Announcements -->

**Words to watch:** I hope this helps, Of course!, Certainly!, You're
absolutely right!, Would you like..., let me know, here is a...

**Problem:** Text meant as chatbot correspondence gets pasted as content.

**Before:**

> Here is an overview of the Prussian Crusade. I hope this helps! Let me know
> if you would like me to expand on any section.

**After:**

> The Prussian Crusade began in 1230 when the Teutonic Knights entered
> Chelmno Land at the invitation of Conrad of Masovia.

### Knowledge-Cutoff Disclaimers
<!-- lang: en -->
<!-- tolerance: 0.35 -->

**Words to watch:** as of [date], Up to my last training update, While specific
details are limited/scarce..., based on available information...

**Problem:** AI disclaimers about incomplete information get left in text.

**Before:**

> While specific details about the priory's founding are not extensively
> documented in readily available sources, it appears to have been established
> sometime in the 13th century.

**After:**

> The priory was founded in 1247, according to its foundation charter held at
> Gniezno.

### Sycophantic/Servile Tone
<!-- lang: en -->
<!-- tolerance: 0.35 -->

**Problem:** Overly positive, people-pleasing language.

**Before:**

> Great question! You are absolutely right that this is a complex topic.
> That is an excellent point about the ecclesiastical factors.

**After:**

> The ecclesiastical factors you mentioned are relevant here.

## FILLER AND HEDGING

### Filler Phrases
<!-- lang: en -->

**Before -> After:**

- "In order to achieve this goal" -> "To achieve this"
- "Due to the fact that it was raining" -> "Because it was raining"
- "At this point in time" -> "Now"
- "In the event that you need help" -> "If you need help"
- "The scriptorium has the ability to produce" -> "The scriptorium can produce"
- "It is important to note that the charter shows" -> "The charter shows"

### Excessive Hedging

**Problem:** Over-qualifying statements.

**Before:**

> It could potentially possibly be argued that the papal decree might have
> some effect on the outcome of the council.

**After:**

> The papal decree may affect the council's outcome.

### Generic Positive Conclusions

**Problem:** Vague upbeat endings.

**Before:**

> The future looks bright for the diocese. Exciting times lie ahead as they
> continue their journey toward excellence. This represents a major step in
> the right direction.

**After:**

> The diocese plans to consecrate two more parish churches before 1350.

### Hyphenated Word Pair Overuse
<!-- lang: en -->
<!-- tolerance: 0.65 -->

**Words to watch:** third-party, cross-functional, client-facing, data-driven,
decision-making, well-known, high-quality, real-time, long-term, end-to-end

**Problem:** AI hyphenates common word pairs with perfect consistency. Humans
rarely hyphenate these uniformly, and when they do, it is inconsistent. Less
common or technical compound modifiers are fine to hyphenate.

**Before:**

> The cross-functional chapter delivered a high-quality, data-driven report on
> our client-facing scriptoria. Their decision-making process was well-known
> for being thorough and detail-oriented.

**After:**

> The cross functional chapter delivered a high quality, data driven report on
> our client facing scriptoria. Their decision making process was known for
> being thorough and detail oriented.

### Persuasive Authority Tropes
<!-- lang: en -->

**Phrases to watch:** The real question is, at its core, in reality, what
really matters, fundamentally, the deeper issue, the heart of the matter

**Problem:** LLMs use these phrases to pretend they are cutting through noise
to some deeper truth, when the sentence that follows usually just restates an
ordinary point with extra ceremony.

**Before:**

> The real question is whether the chapter can adapt. At its core, what really
> matters is conciliar readiness.

**After:**

> The question is whether the chapter can adapt. That mostly depends on whether
> the council is ready to change its procedures.

### Signposting and Announcements
<!-- lang: en -->

**Phrases to watch:** Let's dive in, let's explore, let's break this down,
here's what you need to know, now let's look at, without further ado

**Problem:** LLMs announce what they are about to do instead of doing it.
This meta-commentary slows the writing down and gives it a tutorial-script
feel.

**Before:**

> Let us dive into how the rune carver's workshop operates. Here is what you
> need to know.

**After:**

> A rune carver's workshop keeps several types of antler blank sorted by
> hardness, since different stones require different cutting edges.

### Fragmented Headers

**Signs to watch:** A heading followed by a one-line paragraph that simply
restates the heading before the real content begins.

**Problem:** LLMs often add a generic sentence after a heading as a rhetorical
warm-up. It usually adds nothing and makes the prose feel padded.

**Before:**

> ## Illumination
>
> Quality matters.
>
> When a monk rushes the gilding, the leaf flakes within a generation.

**After:**

> ## Illumination
>
> When a monk rushes the gilding, the leaf flakes within a generation.
