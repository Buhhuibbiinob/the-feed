"use client";

import { useActionState } from "react";
import { updateNewsletterIssue, type NewsletterFormState } from "@/app/actions/newsletter";
import { NEWSLETTER_SECTIONS, type NewsletterIssue } from "@/lib/newsletter";

const initialState: NewsletterFormState = {};

export function NewsletterEditForm({ issue }: { issue: NewsletterIssue }) {
  const [state, formAction, pending] = useActionState(updateNewsletterIssue, initialState);

  return (
    <form action={formAction} className="comment-form">
      <input type="hidden" name="id" value={issue.id} />
      {state.error && <div className="form-error">{state.error}</div>}
      {state.ok && <div className="form-message">Saved.</div>}

      <label className="theme-form-label">Title</label>
      <input name="title" defaultValue={issue.title} />

      <label className="theme-form-label">Issue date</label>
      <input type="date" name="issue_date" defaultValue={issue.issue_date} />

      <label className="theme-form-label">Cover image URL</label>
      <input name="cover_image_url" defaultValue={issue.cover_image_url ?? ""} placeholder="https://..." />

      {NEWSLETTER_SECTIONS.map((section) => (
        <div key={section.key}>
          <label className="theme-form-label">{section.label}</label>
          <textarea
            name={section.key}
            defaultValue={issue[section.key] ?? ""}
            placeholder={section.placeholder}
            rows={4}
          />
        </div>
      ))}

      <div className="form-actions">
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Draft"}
        </button>
      </div>
    </form>
  );
}
