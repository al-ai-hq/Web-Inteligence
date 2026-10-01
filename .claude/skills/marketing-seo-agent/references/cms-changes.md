# Making SEO changes in Webflow or WordPress

## Why this is gated

A CMS edit changes what customers and search engines see right away. A wrong title across a whole template, a broken slug, or an accidental publish can undo months of work and is awkward to reverse. Reading from the CMS is part of normal audit work. Writing to it needs the user's explicit approval for the specific change, in the current conversation. A recommendation in a report is not approval, and neither is "sounds good" about a strategy.

## Procedure

1. **Identify the target from actual tool results.** Use the site ID, page ID, collection or item ID, and post ID that the connected tools return. Never type identifiers from memory, and never guess them from URLs. If more than one site is connected, confirm which site the change applies to.
2. **Read the current state.** Fetch the current SEO title, meta description, slug, Open Graph fields, canonical, and status (draft or published) for each target.
3. **Preview the change** as a table and ask for approval:

   | Site | Page / item | Field | Current | Proposed |
   |---|---|---|---|---|

4. **Apply the smallest approved change.** For bulk edits, apply the change to one or two pages first and read them back before doing the rest.
5. **Don't publish unless publishing was approved.**
   - **Webflow:** page and CMS item changes usually need a separate site publish before they go live. Publishing sends all staged changes on the site live, including other people's unpublished work, so check before publishing.
   - **WordPress:** keep new content as drafts. Editing a published post changes it live.
6. **Verify.** Read the fields back and report what changed. If the change is live, fetch the public URL to confirm it. If you can't read the change back, say that confirmation isn't available.

## Field notes

- **Slugs.** Changing a slug changes the URL. Only do it with a 301 redirect from the old URL and updated internal links, and include both steps in the approval preview.
- **SEO fields in WordPress.** Title and meta values are often stored by an SEO plugin such as Yoast, Rank Math, or All in One SEO, not in core post fields. Check which fields the connected tools can actually edit before promising a change. If they can't reach the plugin fields, give the user the values to paste.
- **Webflow CMS templates.** SEO fields on a collection template are usually built from item fields. Fix the binding on the template, or the item fields it reads from, rather than overriding one page.
- **Tool names change.** Before use, read the connected tools' own descriptions for the exact operations they support.
