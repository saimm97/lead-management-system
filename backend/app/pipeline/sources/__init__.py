"""Registry of ATS adapters, keyed by the `ats` value stored on a pipeline board."""

from app.pipeline.sources import ashby, greenhouse, lever

ADAPTERS = {
    greenhouse.ATS: greenhouse.fetch,
    lever.ATS: lever.fetch,
    ashby.ATS: ashby.fetch,
}
