/**
 * Compatibility shim: custom exercises now live in catalog.json via catalog-store.
 * Callers keep importing from this module.
 */
export {
  loadCatalogStore as loadCustomExercises,
  listCustomExercises,
  addCustomExercise,
  removeCustomExercise,
  getAvailableCatalog
} from './catalog-store'
