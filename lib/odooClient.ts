// lib/odooClient.ts
import xmlrpc from 'xmlrpc';

const ODOO_CONFIG = {
  url: process.env.ODOO_URL!,
  db: process.env.ODOO_DB!,
  username: process.env.ODOO_USER!,
  password: process.env.ODOO_API_KEY || process.env.ODOO_API!,
};

const TENANCY_MODEL = 'property.tenancy';
const PROPERTY_MODEL = 'property.property';
const PARTNER_MODEL = 'res.partner';

// Helper pour créer les clients XML-RPC
function createOdooClient() {
  const urlParts = new URL(ODOO_CONFIG.url);

  const baseOptions = {
    host: urlParts.hostname,
    port: urlParts.port ? parseInt(urlParts.port) : 443,
    headers: { 'User-Agent': 'NodeJS XML-RPC Client' },
  };

  return {
    client: xmlrpc.createSecureClient({
      ...baseOptions,
      path: '/xmlrpc/2/object',
    }),
    common: xmlrpc.createSecureClient({
      ...baseOptions,
      path: '/xmlrpc/2/common',
    }),
  };
}

function authenticate(common: any): Promise<number> {
  return new Promise((resolve, reject) => {
    common.methodCall(
      'authenticate',
      [ODOO_CONFIG.db, ODOO_CONFIG.username, ODOO_CONFIG.password, {}],
      (authErr: any, uid: any) => {
        if (authErr) return reject(authErr);
        resolve(uid as number);
      }
    );
  });
}

/**
 * ✅ NEW: check si un res.partner existe vraiment dans Odoo (par ID).
 * Utilise search_count sur res.partner.
 */
export async function partnerExistsInOdoo(partnerId: number): Promise<boolean> {
  if (!partnerId || partnerId <= 0) return false;

  const { client, common } = createOdooClient();

  try {
    const uid = await authenticate(common);

    const domain = [['id', '=', partnerId]];

    const count = await new Promise<number>((resolve, reject) => {
      client.methodCall(
        'execute_kw',
        [
          ODOO_CONFIG.db,
          uid,
          ODOO_CONFIG.password,
          PARTNER_MODEL,
          'search_count',
          [domain],
        ],
        (err: any, result: any) => {
          if (err) return reject(err);
          resolve(Number(result) || 0);
        }
      );
    });

    return count > 0;
  } catch (err) {
    console.error(
      '[partnerExistsInOdoo] error while checking partner id',
      partnerId,
      err
    );
    // Important: si le check échoue, on ne bloque pas le flux "import".
    // On retourne false pour permettre de continuer.
    return false;
  }
}

/**
 * 1️⃣ Utilisé par app/tickets/new/actions.ts
 * Récupère les tenancies pour un partner (menu déroulant)
 * + enrichissement avec les données de property.property
 * + asset_id = main_property_id
 */
export async function fetchTenanciesFromOdoo(partnerId: number) {
  return new Promise<any[]>((resolve, reject) => {
    const { client, common } = createOdooClient();

    common.methodCall(
      'authenticate',
      [ODOO_CONFIG.db, ODOO_CONFIG.username, ODOO_CONFIG.password, {}],
      (authErr: any, uid: any) => {
        if (authErr) return reject(authErr);

        // 1) Lire les tenancies pour ce partner
        client.methodCall(
          'execute_kw',
          [
            ODOO_CONFIG.db,
            uid,
            ODOO_CONFIG.password,
            TENANCY_MODEL,
            'search_read',
            [[['partner_id', '=', partnerId]]],
            {
              fields: ['id', 'name', 'display_name', 'main_property_id'],
              limit: 50,
            },
          ],
          (searchErr: any, results: any[]) => {
            if (searchErr) return reject(searchErr);

            if (!results || results.length === 0) {
              return resolve([]);
            }

            // Collecte des property IDs via main_property_id
            const propIds = Array.from(
              new Set(
                results
                  .map((t: any) => {
                    const mp = t.main_property_id;
                    return Array.isArray(mp) ? mp[0] : mp;
                  })
                  .filter(Boolean)
              )
            );

            if (propIds.length === 0) {
              // Pas de propriétés liées, on renvoie les tenancies brutes
              return resolve(results);
            }

            // 2) Lire les properties associées
            client.methodCall(
              'execute_kw',
              [
                ODOO_CONFIG.db,
                uid,
                ODOO_CONFIG.password,
                PROPERTY_MODEL,
                'search_read',
                [[['id', 'in', propIds]]],
                {
                  fields: ['id', 'street', 'zip', 'city', 'company_id'],
                  limit: propIds.length,
                },
              ],
              (propErr: any, props: any[]) => {
                if (propErr) return reject(propErr);

                const propMap: Record<number, any> = {};
                (props || []).forEach((p: any) => {
                  propMap[p.id] = p;
                });

                const enriched = results.map((t: any) => {
                  const mp = t.main_property_id;
                  const pid = Array.isArray(mp) ? mp[0] : mp;
                  const p = pid ? propMap[pid] || {} : {};

                  let companyName = '';
                  if (p.company_id && Array.isArray(p.company_id)) {
                    companyName = p.company_id[1] || '';
                  }

                  return {
                    ...t,
                    asset_id: pid ?? null, // 🔴 id de property.property
                    property_street: p.street || '',
                    property_zip: p.zip || '',
                    property_city: p.city || '',
                    property_company: companyName,
                  };
                });

                resolve(enriched);
              }
            );
          }
        );
      }
    );
  });
}

/**
 * Public tenant flow: resolve a property.tenancy by ID -> its tenant (partner)
 * + objet (property). The tenant types this tenancy id as their "Mieter-ID".
 */
export async function fetchTenancyForIdentify(tenancyId: number): Promise<{
  id: number;
  name: string | null;
  partner_id: number | null;
  partner_name: string | null;
  asset_id: number | null;
  property_street: string | null;
  property_zip: string | null;
  property_city: string | null;
  property_company: string | null;
} | null> {
  if (!tenancyId || tenancyId <= 0) return null;

  const { client, common } = createOdooClient();
  const uid = await authenticate(common);

  const exec = <T>(
    model: string,
    method: string,
    args: any[],
    kwargs: Record<string, unknown> = {}
  ) =>
    new Promise<T>((resolve, reject) => {
      client.methodCall(
        'execute_kw',
        [ODOO_CONFIG.db, uid, ODOO_CONFIG.password, model, method, args, kwargs],
        (err: any, result: any) => (err ? reject(err) : resolve(result as T))
      );
    });

  const tenancies = await exec<any[]>(
    TENANCY_MODEL,
    'search_read',
    [[['id', '=', tenancyId]]],
    { fields: ['id', 'name', 'partner_id', 'main_property_id'], limit: 1, context: { active_test: false } }
  );
  if (!tenancies || tenancies.length === 0) return null;

  const t = tenancies[0];
  const partner = t.partner_id;
  const partner_id = Array.isArray(partner)
    ? Number(partner[0])
    : typeof partner === 'number'
    ? partner
    : null;
  const partner_name = Array.isArray(partner) ? String(partner[1]) : null;

  const mp = t.main_property_id;
  const propId = Array.isArray(mp) ? Number(mp[0]) : typeof mp === 'number' ? mp : null;

  let property_street: string | null = null;
  let property_zip: string | null = null;
  let property_city: string | null = null;
  let property_company: string | null = null;

  if (propId) {
    const props = await exec<any[]>(
      PROPERTY_MODEL,
      'search_read',
      [[['id', '=', propId]]],
      { fields: ['id', 'street', 'zip', 'city', 'company_id'], limit: 1, context: { active_test: false } }
    );
    const p = props && props[0];
    if (p) {
      property_street = p.street || null;
      property_zip = p.zip || null;
      property_city = p.city || null;
      property_company = Array.isArray(p.company_id) ? p.company_id[1] || null : null;
    }
  }

  return {
    id: Number(t.id),
    name: t.name || null,
    partner_id,
    partner_name,
    asset_id: propId,
    property_street,
    property_zip,
    property_city,
    property_company,
  };
}

/**
 * 2️⃣ Utilisé par app/tickets/[id]/actions.ts
 * Bridge : partir de odoo_tenancy_id (Supabase) -> property.tenancy -> property.property
 * et renvoyer Tenancy + Objekt + Adresse + dates + REFERENCE + INTERNAL_LABEL (pour le matching tags).
 *
 * ✅ MODIF: ajoute entity_id (proprio) depuis property.property.entity_id
 */
export async function fetchBuildingInfoByTenancy(tenancyId: number) {
  return new Promise<any>((resolve, reject) => {
    const { client, common } = createOdooClient();

    console.log('[fetchBuildingInfoByTenancy] called with tenancyId =', tenancyId);

    common.methodCall(
      'authenticate',
      [ODOO_CONFIG.db, ODOO_CONFIG.username, ODOO_CONFIG.password, {}],
      (authErr: any, uid: any) => {
        if (authErr) {
          console.error('[fetchBuildingInfoByTenancy] auth error:', authErr);
          return reject(authErr);
        }

        // 1) On cherche la tenancy par ID via search_read (plus robuste)
        const tenancyDomain = [['id', '=', tenancyId]];

        client.methodCall(
          'execute_kw',
          [
            ODOO_CONFIG.db,
            uid,
            ODOO_CONFIG.password,
            TENANCY_MODEL,
            'search_read',
            [tenancyDomain],
            {
              fields: ['id', 'name', 'main_property_id'],
              limit: 1,
            },
          ],
          (tenErr: any, tenancies: any[]) => {
            if (tenErr) {
              console.error(
                '[fetchBuildingInfoByTenancy] tenancy search_read error:',
                tenErr
              );
              return reject(tenErr);
            }

            console.log(
              '[fetchBuildingInfoByTenancy] tenancies from Odoo =',
              JSON.stringify(tenancies, null, 2)
            );

            if (!tenancies || tenancies.length === 0) {
              console.warn('No tenancy found in Odoo for id', tenancyId);
              return resolve(null);
            }

            const tenancy = tenancies[0];

            const mainProp = tenancy.main_property_id;
            const propId = Array.isArray(mainProp) ? mainProp[0] : mainProp;

            console.log(
              '[fetchBuildingInfoByTenancy] main_property_id raw =',
              mainProp,
              ' -> propId =',
              propId
            );

            if (!propId) {
              console.warn('Tenancy has no main_property_id', tenancy);
              return resolve({
                tenancy_id: tenancy.id,
                tenancy_name: tenancy.name,
                objekt_label: '',
                property_reference: null,
                property_internal_label: null,
                property_street: null,
                property_zip: null,
                property_city: null,
                construction_year: null,
                last_modernization: null,
                entity_id: null,
                entity_name: null,
              });
            }

            // 2) On lit property.property pour ce main_property_id
            client.methodCall(
              'execute_kw',
              [
                ODOO_CONFIG.db,
                uid,
                ODOO_CONFIG.password,
                PROPERTY_MODEL,
                'read',
                [[propId]],
                {
                  fields: [
                    'id',
                    'name',
                    'reference_id',
                    'internal_label',
                    'street',
                    'zip',
                    'city',
                    'construction_year',
                    'last_modernization',
                    'entity_id', // ✅ NEW
                    'company_id', // ✅ NEW
                  ],
                },
              ],
              (propErr: any, props: any[]) => {
                if (propErr) {
                  console.error(
                    '[fetchBuildingInfoByTenancy] property read error:',
                    propErr
                  );
                  return reject(propErr);
                }

                console.log(
                  '[fetchBuildingInfoByTenancy] property from Odoo =',
                  JSON.stringify(props, null, 2)
                );

                if (!props || props.length === 0) {
                  console.warn('No property found for id', propId);
                  return resolve({
                    tenancy_id: tenancy.id,
                    tenancy_name: tenancy.name,
                    objekt_label: '',
                    property_reference: null,
                    property_internal_label: null,
                    property_street: null,
                    property_zip: null,
                    property_city: null,
                    construction_year: null,
                    last_modernization: null,
                    entity_id: null,
                    entity_name: null,
                  });
                }

                const prop = props[0];

                const ref = prop.reference_id || prop.name || String(prop.id);

                const addressParts = [prop.street, prop.zip, prop.city].filter(Boolean);
                const address = addressParts.join(' ');

                const objektLabel = [ref, address].filter(Boolean).join(' – ');

                const entity = prop.entity_id;
                const entity_id = Array.isArray(entity) ? entity[0] : null;
                const entity_name = Array.isArray(entity) ? entity[1] : null;
                const company = prop.company_id; // [id, name] ou false
                const company_name = Array.isArray(company) ? company[1] : null;

                const payload = {
                  tenancy_id: tenancy.id,
                  tenancy_name: tenancy.name,
                  objekt_label: objektLabel,
                  property_reference: ref,
                  property_internal_label: prop.internal_label || null,
                  property_street: prop.street || null,
                  property_zip: prop.zip || null,
                  property_city: prop.city || null,
                  construction_year: prop.construction_year ?? null,
                  last_modernization: prop.last_modernization ?? null,
                  entity_id,
                  entity_name,
                  company_name, // ✅ NEW
                };

                console.log(
                  '[fetchBuildingInfoByTenancy] final payload =',
                  JSON.stringify(payload, null, 2)
                );

                resolve(payload);
              }
            );
          }
        );
      }
    );
  });
}

/**
 * 3️⃣ Trouve les prestataires "Maintenance" liés au bâtiment spécifique
 * Filtre : category_id.name ilike 'Maintenance'
 *          ET category_id.name ilike internalLabel du bâtiment.
 */
export async function fetchVendorsByReference(internalLabel: string) {
  return new Promise<any[]>((resolve, reject) => {
    const { client, common } = createOdooClient();

    if (!internalLabel) {
      console.warn('fetchVendorsByReference called without internalLabel');
      return resolve([]);
    }

    common.methodCall(
      'authenticate',
      [ODOO_CONFIG.db, ODOO_CONFIG.username, ODOO_CONFIG.password, {}],
      (err: any, uid: any) => {
        if (err) return reject(err);

        const domain = [
          ['category_id.name', 'ilike', 'Maintenance'],
          ['category_id.name', 'ilike', internalLabel],
        ];

        console.log('[fetchVendorsByReference] domain sent to Odoo =', domain);

        client.methodCall(
          'execute_kw',
          [
            ODOO_CONFIG.db,
            uid,
            ODOO_CONFIG.password,
            PARTNER_MODEL,
            'search_read',
            [domain],
            {
              fields: ['id', 'name', 'email', 'phone', 'street', 'zip', 'city', 'category_id'],
              limit: 20,
            },
          ],
          (searchErr: any, results: any[]) => {
            if (searchErr) return reject(searchErr);
            resolve(results);
          }
        );
      }
    );
  });
}

type CreateServiceProviderParams = {
  name: string;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  assetId?: number | null; // property.property.id
};

/**
 * 4️⃣ Crée un prestataire dans res.partner avec tags "Maintenance" + internal_label du property.property
 */
export async function createServiceProviderInOdoo(params: CreateServiceProviderParams) {
  const { name, street, zip, city, email, phone, assetId } = params;

  return new Promise<number>((resolve, reject) => {
    const { client, common } = createOdooClient();

    common.methodCall(
      'authenticate',
      [ODOO_CONFIG.db, ODOO_CONFIG.username, ODOO_CONFIG.password, {}],
      (authErr: any, uid: any) => {
        if (authErr) {
          console.error('[createServiceProviderInOdoo] auth error:', authErr);
          return reject(authErr);
        }

        const proceedWithInternalLabel = (internalLabel: string | null) => {
          const categoryNames: string[] = ['Maintenance'];
          if (internalLabel) categoryNames.push(internalLabel);

          const categoryIds: number[] = [];

          if (categoryNames.length === 0) {
            return createPartner(categoryIds);
          }

          client.methodCall(
            'execute_kw',
            [
              ODOO_CONFIG.db,
              uid,
              ODOO_CONFIG.password,
              'res.partner.category',
              'search_read',
              [[['name', 'in', categoryNames]]],
              {
                fields: ['id', 'name'],
                limit: categoryNames.length,
              },
            ],
            (catErr: any, existing: any[]) => {
              if (catErr) {
                console.error(
                  '[createServiceProviderInOdoo] category search_read error:',
                  catErr
                );
                return reject(catErr);
              }

              const existingByName = new Map<string, number>();
              (existing || []).forEach((c: any) => {
                if (c && c.name && c.id) existingByName.set(c.name, c.id);
              });

              const missingNames: string[] = [];

              for (const catName of categoryNames) {
                if (existingByName.has(catName)) {
                  categoryIds.push(existingByName.get(catName)!);
                } else {
                  missingNames.push(catName);
                }
              }

              const createNextCategory = (index: number) => {
                if (index >= missingNames.length) {
                  return createPartner(categoryIds);
                }

                const nameToCreate = missingNames[index];
                client.methodCall(
                  'execute_kw',
                  [
                    ODOO_CONFIG.db,
                    uid,
                    ODOO_CONFIG.password,
                    'res.partner.category',
                    'create',
                    [{ name: nameToCreate }],
                  ],
                  (createErr: any, newId: any) => {
                    if (createErr) {
                      console.error(
                        '[createServiceProviderInOdoo] category create error:',
                        createErr
                      );
                      return reject(createErr);
                    }
                    categoryIds.push(newId);
                    createNextCategory(index + 1);
                  }
                );
              };

              createNextCategory(0);
            }
          );
        };

        const createPartner = (categoryIds: number[]) => {
          const partnerData: any = { name };
          if (street) partnerData.street = street;
          if (zip) partnerData.zip = zip;
          if (city) partnerData.city = city;
          if (email) partnerData.email = email;
          if (phone) partnerData.phone = phone;
          if (categoryIds.length) {
            partnerData.category_id = [[6, 0, categoryIds]];
          }

          client.methodCall(
            'execute_kw',
            [ODOO_CONFIG.db, uid, ODOO_CONFIG.password, PARTNER_MODEL, 'create', [partnerData]],
            (partnerErr: any, partnerId: any) => {
              if (partnerErr) {
                console.error('[createServiceProviderInOdoo] partner create error:', partnerErr);
                return reject(partnerErr);
              }
              console.log('[createServiceProviderInOdoo] created partner id =', partnerId);
              resolve(partnerId as number);
            }
          );
        };

        if (assetId) {
          client.methodCall(
            'execute_kw',
            [
              ODOO_CONFIG.db,
              uid,
              ODOO_CONFIG.password,
              PROPERTY_MODEL,
              'search_read',
              [[['id', '=', assetId]]],
              {
                fields: ['id', 'internal_label'],
                limit: 1,
              },
            ],
            (propErr: any, props: any[]) => {
              if (propErr) {
                console.error('[createServiceProviderInOdoo] property search_read error:', propErr);
                return proceedWithInternalLabel(null);
              }

              const prop = props && props[0];
              const internalLabel =
                prop && prop.internal_label ? String(prop.internal_label) : null;
              proceedWithInternalLabel(internalLabel);
            }
          );
        } else {
          proceedWithInternalLabel(null);
        }
      }
    );
  });
}

/* -------------------------------------------------------------------------- */
/*                               ✅ NEW HELPERS                               */
/* -------------------------------------------------------------------------- */

export type PartnerDetails = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  vat: string | null;
  contact_address_complete: string | null;
};

export async function fetchPartnerDetails(
  partnerId: number
): Promise<PartnerDetails | null> {
  if (!partnerId || partnerId <= 0) return null;

  return new Promise((resolve, reject) => {
    const { client, common } = createOdooClient();

    common.methodCall(
      'authenticate',
      [ODOO_CONFIG.db, ODOO_CONFIG.username, ODOO_CONFIG.password, {}],
      (authErr: any, uid: any) => {
        if (authErr) return reject(authErr);

        client.methodCall(
          'execute_kw',
          [
            ODOO_CONFIG.db,
            uid,
            ODOO_CONFIG.password,
            PARTNER_MODEL,
            'read',
            [[partnerId]],
            {
              fields: ['id', 'name', 'email', 'phone', 'vat', 'contact_address_complete'],
            },
          ],
          (err: any, partners: any[]) => {
            if (err) return reject(err);
            const p = partners && partners[0];
            if (!p) return resolve(null);

            resolve({
              id: Number(p.id),
              name: p.name ?? null,
              email: p.email ?? null,
              phone: p.phone ?? null,
              vat: p.vat ?? null,
              contact_address_complete: p.contact_address_complete ?? null,
            });
          }
        );
      }
    );
  });
}

export type OfferMailContext = {
  ownerEntity: {
    id: number | null;
    name: string | null;
    vat: string | null;
    address: string | null;
  } | null;

  tenant: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;

  building: {
    tenancy_id: number;
    objekt_label: string | null;
    property_reference: string | null;
    property_internal_label: string | null;
    property_street: string | null;
    property_zip: string | null;
    property_city: string | null;
    entity_id: number | null;
    entity_name: string | null;
    company_name: string | null;      // 👈 NEW
  } | null;
};


export async function fetchOfferMailContext(params: {
  tenancyId: number;
  tenantPartnerId: number; // ticket.tenant_id
}): Promise<OfferMailContext> {
  const { tenancyId, tenantPartnerId } = params;

  const building = await fetchBuildingInfoByTenancy(tenancyId);
  const entityId = building?.entity_id ? Number(building.entity_id) : null;

  const [entityPartner, tenantPartner] = await Promise.all([
    entityId ? fetchPartnerDetails(entityId) : Promise.resolve(null),
    tenantPartnerId ? fetchPartnerDetails(tenantPartnerId) : Promise.resolve(null),
  ]);

  return {
    building: building
      ? {
          tenancy_id: Number(building.tenancy_id),
          objekt_label: building.objekt_label ?? null,
          property_reference: building.property_reference ?? null,
          property_internal_label: building.property_internal_label ?? null,
          property_street: building.property_street ?? null,
          property_zip: building.property_zip ?? null,
          property_city: building.property_city ?? null,
          entity_id: building.entity_id ?? null,
          entity_name: building.entity_name ?? null,
          company_name: building.company_name ?? null, 
        }
      : null,

    ownerEntity: entityPartner
      ? {
          id: entityPartner.id,
          name: entityPartner.name,
          vat: entityPartner.vat,
          address: entityPartner.contact_address_complete,
        }
      : null,

    tenant: tenantPartner
      ? {
          id: tenantPartner.id,
          name: tenantPartner.name,
          email: tenantPartner.email,
          phone: tenantPartner.phone,
          address: tenantPartner.contact_address_complete,
        }
      : null,
  };
}

/**
 * 5️⃣ Récupère les noms et main_property_id pour une liste d'IDs de tenancy.
 * Utilisé par le Backoffice pour enrichir la liste des tickets.
 */
export async function fetchTenanciesNamesByIds(ids: (number | string)[]) {
  console.log("⚡ [OdooClient] fetchTenanciesNamesByIds called with IDs:", ids);

  if (!ids || ids.length === 0) return {};

  const uniqueIds = Array.from(new Set(ids.map(id => Number(id)))).filter((id) => !isNaN(id) && id > 0);

  console.log("🔢 [OdooClient] Converted IDs for Odoo:", uniqueIds);

  if (uniqueIds.length === 0) return {};

  type TenancyInfo = { name: string; property_id: string; property_ref: string; property_city: string; tenant_name: string };

  return new Promise<Record<number, TenancyInfo>>((resolve, reject) => {
    const { client, common } = createOdooClient();

    authenticate(common)
      .then((uid) => {
        client.methodCall(
          'execute_kw',
          [
            ODOO_CONFIG.db,
            uid,
            ODOO_CONFIG.password,
            TENANCY_MODEL,
            'read',
            [uniqueIds],
            {
              // partner_id pour le nom du tenant, main_property_id pour le bien
              fields: ['id', 'name', 'main_property_id', 'partner_id'],
              context: { active_test: false },
            },
          ],
          (readErr: any, results: any[]) => {
            if (readErr) {
              console.error('❌ [OdooClient] read error:', readErr);
              return reject(readErr);
            }

            console.log(`✅ [OdooClient] Received ${results?.length} items from Odoo`);

            const rows = Array.isArray(results) ? results : [];

            // Property id par tenancy + set unique d'ids à résoudre en référence
            const propIdByTenancy: Record<number, number | null> = {};
            const propIds = new Set<number>();
            rows.forEach((item) => {
              let pid: number | null = null;
              if (Array.isArray(item.main_property_id) && item.main_property_id.length > 0) {
                pid = Number(item.main_property_id[0]);
              } else if (item.main_property_id) {
                pid = Number(item.main_property_id);
              }
              propIdByTenancy[item.id] = pid && !isNaN(pid) ? pid : null;
              if (pid && !isNaN(pid)) propIds.add(pid);
            });

            const buildMap = (propInfo: Record<number, { ref: string; city: string }>) => {
              const map: Record<number, TenancyInfo> = {};
              rows.forEach((item) => {
                const pid = propIdByTenancy[item.id];
                const info = pid ? propInfo[pid] : undefined;
                let tenantName = '';
                if (Array.isArray(item.partner_id) && item.partner_id.length > 1) {
                  tenantName = String(item.partner_id[1]);
                }
                map[item.id] = {
                  name: item.name || '',
                  property_id: pid ? String(pid) : '',
                  property_ref: info?.ref || '',
                  property_city: info?.city || '',
                  tenant_name: tenantName,
                };
              });
              resolve(map);
            };

            const propIdArr = Array.from(propIds);
            if (propIdArr.length === 0) {
              return buildMap({});
            }

            // Résout les références de bien (ex: "AD2", "AC10") en un seul read
            client.methodCall(
              'execute_kw',
              [
                ODOO_CONFIG.db,
                uid,
                ODOO_CONFIG.password,
                PROPERTY_MODEL,
                'read',
                [propIdArr],
                { fields: ['id', 'reference_id', 'city'] },
              ],
              (propErr: any, propResults: any[]) => {
                if (propErr) {
                  console.error('❌ [OdooClient] property read error:', propErr);
                  return buildMap({}); // dégrade proprement — infos vides
                }
                const propInfo: Record<number, { ref: string; city: string }> = {};
                (Array.isArray(propResults) ? propResults : []).forEach((p) => {
                  propInfo[p.id] = {
                    ref: p.reference_id ? String(p.reference_id) : '',
                    city: p.city ? String(p.city) : '',
                  };
                });
                buildMap(propInfo);
              }
            );
          }
        );
      })
      .catch((err) => {
        console.error('❌ [OdooClient] Auth failed:', err);
        reject(err);
      });
  });
}

export async function fetchPartnerNamesByIds(ids: (number | string)[]): Promise<Record<number, string>> {
  console.log("⚡ [OdooClient] fetchPartnerNamesByIds called with IDs:", ids);

  if (!ids || ids.length === 0) return {};

  const uniqueIds = Array.from(new Set(ids.map(id => Number(id)))).filter((id) => !isNaN(id) && id > 0);

  if (uniqueIds.length === 0) return {};

  return new Promise<Record<number, string>>((resolve, reject) => {
    const { client, common } = createOdooClient();

    authenticate(common)
      .then((uid) => {
        client.methodCall(
          'execute_kw',
          [
            ODOO_CONFIG.db,
            uid,
            ODOO_CONFIG.password,
            PARTNER_MODEL,  // 'res.partner'
            'read',
            [uniqueIds],
            {
              fields: ['id', 'name'],
              context: { active_test: false }
            },
          ],
          (readErr: any, results: any[]) => {
            if (readErr) {
              console.error('❌ [OdooClient] read partner error:', readErr);
              return reject(readErr);
            }

            console.log(`✅ [OdooClient] Received ${results?.length} partners from Odoo`);

            const map: Record<number, string> = {};

            if (results && Array.isArray(results)) {
              results.forEach((item) => {
                map[item.id] = item.name || '';
              });
            }
            resolve(map);
          }
        );
      })
      .catch((err) => {
        console.error('❌ [OdooClient] Auth failed:', err);
        reject(err);
      });
  });
}

// ============================================================
// AJOUTER dans lib/odooClient.ts
// Fonction pour récupérer le profil complet d'un partner
// ============================================================

export type PartnerProfile = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  vat: string | null;
};

/**
 * Récupère le profil complet d'un res.partner
 */
export async function fetchPartnerProfile(partnerId: number): Promise<PartnerProfile | null> {
  console.log("⚡ [OdooClient] fetchPartnerProfile called for ID:", partnerId);

  if (!partnerId || partnerId <= 0) {
    console.log("⚠️ [OdooClient] Invalid partnerId");
    return null;
  }

  const { client, common } = createOdooClient();

  try {
    const uid = await authenticate(common);
    console.log("✅ [OdooClient] Authenticated, uid:", uid);

    return new Promise<PartnerProfile | null>((resolve, reject) => {
      // Utiliser search_read avec domain au lieu de read
      client.methodCall(
        'execute_kw',
        [
          ODOO_CONFIG.db,
          uid,
          ODOO_CONFIG.password,
          PARTNER_MODEL,
          'search_read',
          [[['id', '=', partnerId]]],  // domain: id = partnerId
          {
            fields: [
              'id',
              'name',
              'email',
              'phone',
              'mobile',
              'contact_address_complete',
              'vat',
            ],
            limit: 1,
            context: { active_test: false }
          },
        ],
        (readErr: any, results: any[]) => {
          if (readErr) {
            console.error('❌ [OdooClient] search_read error:', readErr);
            return resolve(null);
          }

          console.log('📦 [OdooClient] Raw results:', JSON.stringify(results));

          if (!results || results.length === 0) {
            console.log('⚠️ [OdooClient] No partner found');
            return resolve(null);
          }

          const partner = results[0];
          console.log('✅ [OdooClient] Partner name:', partner.name);

          const profile: PartnerProfile = {
            id: partner.id,
            name: partner.name || '',
            email: partner.email || null,
            phone: partner.phone || null,
            mobile: partner.mobile || null,
            address: partner.contact_address_complete || null,
            vat: partner.vat || null,
          };

          console.log('🏁 [OdooClient] Returning profile:', JSON.stringify(profile));
          resolve(profile);
        }
      );
    });
  } catch (err) {
    console.error('❌ [OdooClient] fetchPartnerProfile error:', err);
    return null;
  }
}

/**
 * ✅ Admin: récupère toutes les tenancies + enrichissement property.property
 * + BRIDGE vers res.partner via property.tenancy.partner_id
 */
export async function fetchAllTenanciesFromOdoo(options?: {
  limit?: number;
}): Promise<any[]> {
  const limit = options?.limit ?? 5000;

  return new Promise<any[]>((resolve, reject) => {
    const { client, common } = createOdooClient();

    common.methodCall(
      'authenticate',
      [ODOO_CONFIG.db, ODOO_CONFIG.username, ODOO_CONFIG.password, {}],
      (authErr: any, uid: any) => {
        if (authErr) return reject(authErr);

        const domain: any[] = []; // => toutes les tenancies

        client.methodCall(
          'execute_kw',
          [
            ODOO_CONFIG.db,
            uid,
            ODOO_CONFIG.password,
            TENANCY_MODEL,
            'search_read',
            [domain],
            {
              // ✅ partner_id ajouté ici
              fields: ['id', 'name', 'display_name', 'main_property_id', 'partner_id'],
              limit,
              context: { active_test: false },
            },
          ],
          (searchErr: any, results: any[]) => {
            if (searchErr) return reject(searchErr);
            if (!results || results.length === 0) return resolve([]);

            // Collecte des property IDs via main_property_id
            const propIds = Array.from(
              new Set(
                results
                  .map((t: any) => {
                    const mp = t.main_property_id;
                    return Array.isArray(mp) ? mp[0] : mp;
                  })
                  .filter(Boolean)
              )
            );

            if (propIds.length === 0) {
              // Même sans property, on renvoie déjà partner_id formaté
              const minimal = results.map((t: any) => {
                const partner = t.partner_id;
                const tenant_partner_id = Array.isArray(partner) ? partner[0] : null;
                const tenant_partner_name = Array.isArray(partner) ? partner[1] : null;

                return {
                  ...t,
                  tenant_partner_id,
                  tenant_partner_name,
                  asset_id: null,
                  property_street: '',
                  property_zip: '',
                  property_city: '',
                  property_company: '',
                  property_entity_id: null,
                  property_entity_name: null,
                };
              });
              return resolve(minimal);
            }

            // Lire les properties associées
            client.methodCall(
              'execute_kw',
              [
                ODOO_CONFIG.db,
                uid,
                ODOO_CONFIG.password,
                PROPERTY_MODEL,
                'search_read',
                [[['id', 'in', propIds]]],
                {
                  fields: ['id', 'street', 'zip', 'city', 'company_id', 'entity_id'],
                  limit: propIds.length,
                  context: { active_test: false },
                },
              ],
              (propErr: any, props: any[]) => {
                if (propErr) return reject(propErr);

                const propMap: Record<number, any> = {};
                (props || []).forEach((p: any) => {
                  propMap[p.id] = p;
                });

                const enriched = results.map((t: any) => {
                  const mp = t.main_property_id;
                  const pid = Array.isArray(mp) ? mp[0] : mp;
                  const p = pid ? propMap[pid] || {} : {};

                  const companyName =
                    p.company_id && Array.isArray(p.company_id) ? p.company_id[1] || '' : '';

                  const entityId =
                    p.entity_id && Array.isArray(p.entity_id) ? (p.entity_id[0] as number) : null;

                  const entityName =
                    p.entity_id && Array.isArray(p.entity_id) ? (p.entity_id[1] as string) : null;

                  const partner = t.partner_id;
                  const tenant_partner_id = Array.isArray(partner) ? partner[0] : null;
                  const tenant_partner_name = Array.isArray(partner) ? partner[1] : null;

                  return {
                    ...t,
                    asset_id: pid ?? null, // property.property.id
                    property_street: p.street || '',
                    property_zip: p.zip || '',
                    property_city: p.city || '',
                    property_company: companyName,
                    property_entity_id: entityId,
                    property_entity_name: entityName,
                    tenant_partner_id,
                    tenant_partner_name,
                  };
                });

                resolve(enriched);
              }
            );
          }
        );
      }
    );
  });
}
