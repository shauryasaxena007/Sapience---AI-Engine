const stack = [
  ['Frontend', 'React, Vite, Tailwind CSS, React Router'],
  ['Backend', 'Node.js, Express, REST, Server-Sent Events'],
  ['Database', 'MySQL with full-text search'],
  ['Auth', 'bcrypt, JWT access tokens and rotating refresh tokens in httpOnly cookies'],
  ['AI and search', 'Groq API for answers, Tavily for web results'],
  ['Microsoft', 'OAuth 2.0 with PKCE and the Microsoft Graph OneNote API'],
];

const sections = [
  ['Problem', 'AI chats give answers that disappear into a history list. Notes made by copy and paste lose their sources, and plain chatbots rarely show where a claim came from.'],
  ['Solution', 'NoteWise searches the web, answers with numbered citations, and saves the useful parts into the user\'s real OneNote with one click.'],
  ['AI workflow', 'Question, then authentication and rate limiting, then web search, then a prompt that includes numbered sources, then a streamed model answer, then saving the answer and its sources to the database.'],
  ['OneNote integration', 'The user signs in with Microsoft using OAuth 2.0 and PKCE. The server keeps the tokens encrypted, refreshes them when needed, and calls the Graph API to list notebooks and sections and to create pages. Microsoft requires user sign-in for OneNote, so the app only acts when a signed-in user chooses to save.'],
  ['Database', 'Users, settings, conversations, messages, message sources, files, connected accounts, OAuth states and saved items, linked by foreign keys with cascading deletes.'],
  ['Security', 'Passwords are hashed, tokens live in httpOnly cookies, Microsoft tokens are encrypted at rest, every query is scoped to the signed-in user, uploads are checked by file signature, and AI and auth routes are rate limited.'],
  ['Future improvements', 'Regenerate answers, image generation, chat export, answers grounded in the user\'s own documents, and other note apps.'],
];

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        <header>
          <h1 className="font-serif text-3xl">About Sapience AI</h1>
          <p className="mt-2 text-mute">An AI search assistant that answers with sources and saves what you keep to your own OneNote.</p>
        </header>
        <section>
          <h2 className="mb-3 text-lg font-semibold">Technology</h2>
          <dl className="card divide-y divide-line text-sm">
            {stack.map(([k, v]) => (
              <div key={k} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr]"><dt className="font-semibold">{k}</dt><dd className="text-mute">{v}</dd></div>
            ))}
          </dl>
        </section>
        {sections.map(([title, text]) => (
          <section key={title}>
            <h2 className="mb-1 text-lg font-semibold">{title}</h2>
            <p className="text-mute">{text}</p>
          </section>
        ))}
        
<section className="card p-5 text-sm">
  <h2 className="mb-2 text-lg font-semibold">Developer</h2>

  <p className="font-medium">
    Shaurya Saxena
  </p>

  <p className="text-mute mb-2">
    Aspiring Data Scientist and Web Developer
  </p>

  <p className="text-mute">
    GitHub:{" "}
    <a
      href="https://github.com/shauryasaxena007"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 hover:underline"
    >
      GitHub Profile
    </a>
  </p>

  <p className="text-mute">
    Portfolio:{" "}
    <a
      href="https://portfolio-hmuy94lsd-shauryasaxena007s-projects.vercel.app"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 hover:underline"
    >
      Visit Portfolio
    </a>
  </p>
</section>

      </div>
    </div>
  );
}
