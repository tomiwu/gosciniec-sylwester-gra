import { OFFER } from "./config";
import { pl } from "./i18n/pl";
import "./styles.css";

const app = document.querySelector("#app");
if (!(app instanceof HTMLElement)) {
  throw new Error("The #app root is missing.");
}

const bookHref = OFFER.bookingUrl;

app.innerHTML = `
  <section class="panel" data-screen="start">
    <p class="logo">${pl.hotel}</p>
    <h1 class="title">${pl.title}</h1>
    <p class="subtitle">${pl.subtitle}</p>
    <p class="price-was">${pl.offerWas}</p>
    <p class="price">${pl.offerPrice}</p>
    <p class="how">${pl.howTo}</p>
    <div class="actions">
      <button type="button" class="btn" id="play" disabled>${pl.play}</button>
      <a class="btn secondary" id="book" href="${bookHref}">${pl.book}</a>
    </div>
    <p class="note">${pl.localOnly}</p>
  </section>
`;
