# ashwin-site

The personal site of Ashwin Thomas, a Product & Technical Program Manager in Toronto.

It's a static site with no build step. The page lives in `builds/portfolio/site/`: plain
HTML and CSS, a small scroll engine (`scrollcraft.js`), and `site.js` for the margin
navigation and the "time ruler". Every push to `main` deploys it to GitHub Pages through
`.github/workflows/pages.yml`.

To preview it locally:

```bash
python3 -m http.server 4500 --directory builds/portfolio/site
```
