import 'dotenv/config';
import { getDatabase, closeDatabase } from '../src/server/db/index';
import { RegionModel } from '../src/server/db/models/regions';
import { UserRoleModel } from '../src/server/db/models/userRoles';
import { UserRoleType } from '../src/shared/types';

interface OnboardOptions {
  cityName: string;
  lat?: number;
  lon?: number;
  districts: string[];
}

export function onboardCity(options: OnboardOptions) {
  const db = getDatabase();
  const regionModel = new RegionModel(db);
  const userRoleModel = new UserRoleModel(db);

  console.log(`\n🏙️  Onboarding neue Stadt: ${options.cityName}...`);

  // 1. Create parent city region
  const parentRegion = regionModel.createRegion({
    name: `${options.cityName} (Landesbezirk)`,
    parent_id: null,
    type: 1,
    lat: options.lat ?? null,
    lon: options.lon ?? null
  });

  console.log(`✅ Hauptregion angelegt: #${parentRegion.id} - ${parentRegion.name}`);

  // 2. Create sub-districts
  const createdDistricts = [];
  for (const districtName of options.districts) {
    const trimmed = districtName.trim();
    if (!trimmed) continue;

    const district = regionModel.createRegion({
      name: trimmed,
      parent_id: parentRegion.id,
      type: 2,
      lat: options.lat ?? null,
      lon: options.lon ?? null
    });
    createdDistricts.push(district);
    console.log(`   └─ Bezirk angelegt: #${district.id} - ${district.name}`);
  }

  // 3. Generate regional manager invite link
  const invite = userRoleModel.createInviteToken({
    region_id: parentRegion.id,
    created_by_user_id: 'system:onboard-script',
    target_role: UserRoleType.WORKGROUP_GIVING_STORES,
    expiresInDays: 30
  });

  console.log(`\n🎟️  Einladungslink für Koordinationsgruppe (${options.cityName}):`);
  console.log(`   Rolle: ${UserRoleType.WORKGROUP_GIVING_STORES} (vererbt auf alle ${createdDistricts.length} Bezirke)`);
  console.log(`   Token: ${invite.rawToken}`);
  console.log(`   Link:  https://abgabestellen.app/invite?token=${invite.rawToken}`);
  console.log(`   Gültig bis: ${invite.expiresAt}\n`);

  return {
    parentRegion,
    districts: createdDistricts,
    invite
  };
}

// CLI Execution
if (process.argv[1]?.endsWith('onboard-city.ts')) {
  const args = process.argv.slice(2);
  const cityName = args[0] || 'Köln';
  const districtsArg = args.find(a => a.startsWith('--districts='))?.split('=')[1] 
    || 'Innenstadt,Rodenkirchen,Lindenthal,Ehrenfeld,Nippes,Chorweiler,Porz,Kalk,Mülheim';
  const districts = districtsArg.split(',');

  try {
    onboardCity({ cityName, districts });
    closeDatabase();
  } catch (err) {
    console.error('❌ Fehler beim Onboarding:', err);
    process.exit(1);
  }
}
