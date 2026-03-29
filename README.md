<div align="center">
  <img src="astro-site/public/Media/header_logo.png" alt="ChemAI Lab Logo" width="120" />
  <h1>ChemAI Laboratory</h1>
  <p><strong>McMaster University</strong></p>
  <p><em>Integrating artificial intelligence, machine learning, and quantum chemistry and materials science.</em></p>
</div>

---

### Overview
This repository contains the source code for the public-facing website of the **ChemAI Lab**, led by Dr. Rodrigo A. Vargas-Hernández at the Department of Chemistry & Chemical Biology, McMaster University. 

The website is engineered with a modern, zero-JS **Astro** and **Tailwind CSS** stack. It leverages statically generated islands to prioritize elite geographic performance, strict architectural typography, and a premium "research boutique" aesthetic.

### Development Workflow

All application code is cleanly isolated inside the `astro-site/` directory. 

```bash
# Navigate to the core project
cd astro-site

# Install dependencies (Node 18+ required)
npm install

# Start the local development server at http://localhost:4321
npm run dev

# Build statically for production
npm run build
```

### Content Updates
To make the site highly maintainable by future lab members, all core data is dynamically driven through strictly-typed JSON collections inside `astro-site/src/content/`:

- **Team Roster:** `/people/`
- **Publications:** `/publications/`
- **Announcements:** `/news/`
- **Courses:** `/teaching/`

Adding a new individual or publication is as simple as creating a new `.json` file inside the appropriate directory conforming to the documented schema—the Astro build engine will automatically sort, hierarchically rank, and layout the entries.

---
<br/>
<div align="center">
  <a href="https://www.mcmaster.ca/">
    <img src="https://upload.wikimedia.org/wikipedia/en/5/53/McMaster_University_logo.svg" alt="McMaster University" width="150" />
  </a>
</div>
