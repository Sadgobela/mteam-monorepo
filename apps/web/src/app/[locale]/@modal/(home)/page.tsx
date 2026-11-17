// The home page clears the modal too; it is not reached by the catch-all. In a route group, like the home page itself:
// a page at the slot's root made Next send the page's search, Georgian place names included, in a request header after
// a link click, which the browser refuses, so every later link on that page fell back to a full reload.
export { default } from "../default";
