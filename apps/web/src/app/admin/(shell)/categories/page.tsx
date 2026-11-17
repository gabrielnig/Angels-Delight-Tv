import type { Metadata } from 'next';
import { CategoriesManager } from '@/components/admin/CategoriesManager';
import { PageHeader } from '@/components/admin/PageHeader';
import { NoAccess } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { collectionService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import {
  createCategoryAction,
  deleteCategoryAction,
  hideCategoryAction,
  moveCategoryAction,
  renameCategoryAction,
} from './actions';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  const actor = await requireActor('/admin/categories');
  if (!can(actor.role, 'category.manage'))
    return (
      <NoAccess
        pageName="Categories"
        roleLabel={ROLE_LABELS[actor.role]}
        needed="editors and admins"
      />
    );
  const categories = await collectionService.categories(actor);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Categories' }]}
        title="Categories"
        lead="The order here is the order viewers see on the home page."
      />
      <CategoriesManager
        categories={categories}
        canManage
        actions={{
          create: createCategoryAction,
          rename: renameCategoryAction,
          hide: hideCategoryAction,
          move: moveCategoryAction,
          remove: deleteCategoryAction,
        }}
      />
    </>
  );
}
