import { db, schema } from './index';
import { eq } from 'drizzle-orm';
import { CONTENT_THEME_SEEDS, CONTENT_THEME_SEED_REVISION } from '../../core/presets/contentThemeSeeds';

// Generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

function getContentThemeSeedRevision(variantsData: string | null | undefined) {
  try {
    const variants = JSON.parse(variantsData || '[]');
    const defaultVariant = Array.isArray(variants) ? variants.find((variant) => variant?.id === 'default') : null;
    return Number(defaultVariant?.seedRevision) || 0;
  } catch {
    return 0;
  }
}

export function seedDatabase() {
  console.log('[Seed] Checking database data...');

  // 1. Seed Themes
  const existingThemes = db.select().from(schema.themes).limit(1).all();
  let defaultThemeId = '';
  
  if (existingThemes.length === 0) {
    defaultThemeId = generateId();
    db.insert(schema.themes).values({
      id: defaultThemeId,
      name: 'Default Dark',
      isDefault: true,
      backgroundType: 'solid',
      backgroundValue: '#1a1a2e',
      textStyle: JSON.stringify({
        fontFamily: 'Inter',
        fontSize: 72,
        fontWeight: 700,
        color: '#ffffff',
        textAlign: 'center',
        textShadow: '2px 2px 8px rgba(0,0,0,0.8)'
      }),
    }).run();
  } else {
    defaultThemeId = (existingThemes[0] as any).id;
  }

  // 2. Songs: Default library starts empty for distribution build
  // User will import or create their own songs.

  // 3. Seed Content Themes. Stage/confidence compositions belong to
  // built-in Screen Layouts, not to this content-bound template table.
  for (const tpl of CONTENT_THEME_SEEDS) {
    const existing = db.select().from(schema.templates).where(eq(schema.templates.name, tpl.name)).get();
    if (!existing) {
      const templateId = generateId();
      db.insert(schema.templates).values({
        id: templateId,
        name: tpl.name,
        category: tpl.category,
        contentType: tpl.contentType,
        layersData: tpl.layersData,
        variantsData: tpl.variantsData,
      }).run();
    } else {
      const isUnmodifiedSeed = Boolean(existing.createdAt && existing.createdAt === existing.updatedAt);
      const seedRevision = getContentThemeSeedRevision(existing.variantsData);
      if (isUnmodifiedSeed && seedRevision < CONTENT_THEME_SEED_REVISION) {
        db.update(schema.templates)
          .set({
            category: tpl.category,
            contentType: tpl.contentType,
            layersData: tpl.layersData,
            variantsData: tpl.variantsData,
            previewUrl: null,
          })
          .where(eq(schema.templates.id, existing.id))
          .run();
      }
    }
  }

  // Songs without a theme remain NULL. Their assigned Screen Layout decides
  // whether to follow, fall back to, or force a Content Theme.
}
