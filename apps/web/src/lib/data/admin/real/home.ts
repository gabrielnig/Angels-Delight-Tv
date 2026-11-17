import 'server-only';
import {
  getAdminHome,
  listAdminCategories,
  listAdminSeries,
  listAdminVideos,
  publishAdminHome,
  restorePreviousAdminHome,
  saveAdminHomeDraft,
} from '@ad/catalog';
import type { HomeService } from '../services';
import { catalogActor, context, need, toRecords } from './shared';

export const realHomeService: HomeService = {
  async get(actor) {
    need(actor, 'home.curate');
    const ctx = await context();
    const who = catalogActor(actor);
    const [{ state }, videos, series, categories] = await Promise.all([
      getAdminHome(ctx, who),
      listAdminVideos(ctx, who),
      listAdminSeries(ctx, who),
      listAdminCategories(ctx, who),
    ]);
    return {
      state,
      videos: await toRecords(actor, videos),
      series: series.map(({ id, title, description, posterId, published }) => ({
        id,
        title,
        description,
        posterId,
        published,
      })),
      categories: categories.map(({ id, name, hidden, position }) => ({
        id,
        name,
        hidden,
        position,
      })),
    };
  },
  async saveDraft(actor, config) {
    need(actor, 'home.curate');
    return saveAdminHomeDraft(await context(), catalogActor(actor), config);
  },
  async publish(actor, config) {
    need(actor, 'home.curate');
    return publishAdminHome(await context(), catalogActor(actor), config);
  },
  async restorePrevious(actor) {
    need(actor, 'home.curate');
    return restorePreviousAdminHome(await context(), catalogActor(actor));
  },
};
