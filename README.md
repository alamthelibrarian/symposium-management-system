# Symposium Management System

A lightweight, browser-based tool for moderators and operators to organize symposium presentation sessions, open presentation materials, and control session timing.

## Features
- Manage symposium sessions across multiple dates.
- Add, edit, remove, and reorder presenters.
- Attach PDF or PPTX files, or link to Canva presentations.
- Store uploaded files locally in the current browser using IndexedDB.
- Presentation, Q&A, and transition timers with start, pause, reset, phase navigation, and audible alert.
- Export and import schedule metadata as JSON.
- Responsive interface for laptop and projector-side operation.

## Getting started
Open index.html in a modern browser. No build step, server, account, or external dependency is required.

## Important notes
- Uploaded files are stored in the current browser on the current device. They are not uploaded to a server or automatically shared with other operators.
- JSON export includes schedule metadata and links, but not uploaded file binaries. Keep original presentation files separately.
- PDF files can be opened in the browser. PPTX files may download or open in a compatible local application depending on browser settings. Canva links open in a new tab.
- This is a presentation-session tool, not a full conference management platform. It does not provide registration, abstract submission, peer review, or participant administration.

## Default event schedule
- Event hours: 13:00–15:30 WIB.
- Presenter allocation: 10 minutes presentation, 8 minutes Q&A, and 2 minutes transition.
- Opening and closing blocks are managed separately by the moderator.

## License
No license has been selected yet. All rights reserved by the repository owner unless a license is added.
