import 'server-only';
import {
  createAdminCategory,
  createAdminSeries,
  deleteAdminCategory,
  deleteAdminSeries,
  getAdminSeriesDetail,
  listAdminCategories,
  listAdminSeries,
  moveAdminCategory,
  renameAdminCategory,
  setAdminCategoryHidden,
  setAdminEpisode,
  updateAdminSeries,
} from '@ad/catalog';
import type { CollectionService } from '../services';
import { asResult, catalogActor, context, need, toRecords } from './shared';

export const realCollectionService: CollectionService = {
  async categories(actor) {
    need(actor, 'category.manage');
    return listAdminCategories(await context(), catalogActor(actor));
  },
  async createCategory(actor, name) {
    need(actor, 'category.manage');
    return createAdminCategory(await context(), catalogActor(actor), name);
  },
  async renameCategory(actor, id, name) {
    need(actor, 'category.manage');
    return renameAdminCategory(await context(), catalogActor(actor), id, name);
  },
  async setCategoryHidden(actor, id, hidden) {
    need(actor, 'category.manage');
    return setAdminCategoryHidden(await context(), catalogActor(actor), id, hidden);
  },
  async moveCategory(actor, id, delta) {
    need(actor, 'category.manage');
    return moveAdminCategory(await context(), catalogActor(actor), id, delta);
  },
  async deleteCategory(actor, id) {
    need(actor, 'category.manage');
    return deleteAdminCategory(await context(), catalogActor(actor), id);
  },
  async seriesList(actor) {
    need(actor, 'series.manage');
    return listAdminSeries(await context(), catalogActor(actor));
  },
  async seriesDetail(actor, id) {
    need(actor, 'series.manage');
    const detail = await getAdminSeriesDetail(await context(), catalogActor(actor), id);
    const { episodeCount: _count, ...series } = detail.series;
    void _count;
    return {
      series,
      episodes: await toRecords(actor, detail.episodes),
      available: await toRecords(actor, detail.available),
    };
  },
  async createSeries(actor, input) {
    need(actor, 'series.manage');
    return createAdminSeries(await context(), catalogActor(actor), input);
  },
  async updateSeries(actor, id, patch) {
    need(actor, 'series.manage');
    const ctx = await context();
    return asResult(() => updateAdminSeries(ctx, catalogActor(actor), id, patch));
  },
  async deleteSeries(actor, id) {
    need(actor, 'series.manage');
    return deleteAdminSeries(await context(), catalogActor(actor), id);
  },
  async setEpisode(actor, videoId, seriesId, season, episode) {
    need(actor, 'series.manage');
    return setAdminEpisode(
      await context(),
      catalogActor(actor),
      videoId,
      seriesId,
      season,
      episode,
    );
  },
};
