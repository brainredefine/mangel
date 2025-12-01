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
 * 2️⃣ Utilisé par app/tickets/[id]/actions.ts
 * Bridge : partir de odoo_tenancy_id (Supabase) -> property.tenancy -> property.property
 * et renvoyer Tenancy + Objekt + Adresse + dates + REFERENCE + INTERNAL_LABEL (pour le matching tags).
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
            TENANCY_MODEL, // ex: 'property.tenancy'
            'search_read',
            [tenancyDomain],
            {
              fields: ['id', 'name', 'main_property_id'],
              limit: 1,
            },
          ],
          (tenErr: any, tenancies: any[]) => {
            if (tenErr) {
              console.error('[fetchBuildingInfoByTenancy] tenancy search_read error:', tenErr);
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

            // main_property_id est un many2one -> [id, label] OU directement un id
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
              });
            }

            // 2) On lit property.property pour ce main_property_id
            client.methodCall(
              'execute_kw',
              [
                ODOO_CONFIG.db,
                uid,
                ODOO_CONFIG.password,
                PROPERTY_MODEL, // ex: 'property.property'
                'read',
                [[propId]],
                {
                  fields: [
                    'id',
                    'name',
                    'reference_id',
                    'internal_label',       // <— important pour tes vendors
                    'street',
                    'zip',
                    'city',
                    'construction_year',
                    'last_modernization',
                  ],
                },
              ],
              (propErr: any, props: any[]) => {
                if (propErr) {
                  console.error('[fetchBuildingInfoByTenancy] property read error:', propErr);
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
                  });
                }

                const prop = props[0];

                const ref = prop.reference_id || prop.name || String(prop.id);

                const addressParts = [prop.street, prop.zip, prop.city].filter(
                  Boolean
                );
                const address = addressParts.join(' ');

                const objektLabel = [ref, address].filter(Boolean).join(' – ');

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
              fields: [
                'id',
                'name',
                'email',
                'phone',
                'street',   // 🆕
                'zip',      // 🆕
                'city',     // (on l’avait déjà, on garde)
                'category_id',
              ],
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

        // Helper pour continuer une fois qu'on a internalLabel (ou pas)
        const proceedWithInternalLabel = (internalLabel: string | null) => {
          const categoryNames: string[] = ['Maintenance'];
          if (internalLabel) categoryNames.push(internalLabel);

          const categoryIds: number[] = [];

          if (categoryNames.length === 0) {
            // Pas de tags -> on crée directement le partner
            return createPartner(categoryIds);
          }

          // 1) Chercher les catégories existantes (⚠️ ici on passe bien un kwargs object)
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
                if (c && c.name && c.id) {
                  existingByName.set(c.name, c.id);
                }
              });

              const missingNames: string[] = [];

              for (const catName of categoryNames) {
                if (existingByName.has(catName)) {
                  categoryIds.push(existingByName.get(catName)!);
                } else {
                  missingNames.push(catName);
                }
              }

              // 2) Créer les catégories manquantes en série
              const createNextCategory = (index: number) => {
                if (index >= missingNames.length) {
                  // Tout créé -> on peut créer le partenaire
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

        // Helper pour créer le partenaire une fois qu'on a les categoryIds
        const createPartner = (categoryIds: number[]) => {
          const partnerData: any = {
            name,
          };
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
            [
              ODOO_CONFIG.db,
              uid,
              ODOO_CONFIG.password,
              PARTNER_MODEL,
              'create',
              [partnerData],
            ],
            (partnerErr: any, partnerId: any) => {
              if (partnerErr) {
                console.error(
                  '[createServiceProviderInOdoo] partner create error:',
                  partnerErr
                );
                return reject(partnerErr);
              }
              console.log(
                '[createServiceProviderInOdoo] created partner id =',
                partnerId
              );
              resolve(partnerId as number);
            }
          );
        };

        // Si on a un assetId -> on va chercher internal_label sur property.property
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
                console.error(
                  '[createServiceProviderInOdoo] property search_read error:',
                  propErr
                );
                // On continue sans internal_label
                return proceedWithInternalLabel(null);
              }

              const prop = props && props[0];
              const internalLabel =
                prop && prop.internal_label
                  ? String(prop.internal_label)
                  : null;
              proceedWithInternalLabel(internalLabel);
            }
          );
        } else {
          // Pas d'asset -> pas d'internal_label
          proceedWithInternalLabel(null);
        }
      }
    );
  });
}
