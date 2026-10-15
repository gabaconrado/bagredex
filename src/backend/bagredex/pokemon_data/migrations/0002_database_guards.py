"""PostgreSQL guards for immutable imports and version-local relationships."""

from django.db import migrations

VERSION_OWNED_TABLES = (
    "pokemon_data_mechanicsprofile",
    "pokemon_data_regulation",
    "pokemon_data_pokemonform",
    "pokemon_data_type",
    "pokemon_data_ability",
    "pokemon_data_move",
    "pokemon_data_moveflag",
    "pokemon_data_abilityprofile",
    "pokemon_data_moveprofile",
    "pokemon_data_pokemonprofile",
    "pokemon_data_regulationmembership",
    "pokemon_data_pokemonprofiletype",
    "pokemon_data_pokemonprofileability",
    "pokemon_data_moveflagrelation",
    "pokemon_data_megarelation",
    "pokemon_data_learnsetentry",
    "pokemon_data_spritemapping",
    "pokemon_data_sprite",
)

VERSION_GUARD_TABLES = (
    "pokemon_data_regulation",
    "pokemon_data_pokemonform",
    "pokemon_data_abilityprofile",
    "pokemon_data_moveprofile",
    "pokemon_data_pokemonprofile",
    "pokemon_data_pokemonprofiletype",
    "pokemon_data_pokemonprofileability",
    "pokemon_data_moveflagrelation",
    "pokemon_data_megarelation",
    "pokemon_data_learnsetentry",
    "pokemon_data_spritemapping",
    "pokemon_data_sprite",
)

CREATE_IMMUTABILITY_GUARDS = (
    """
CREATE FUNCTION pokemon_data_guard_version_state() RETURNS trigger AS $$
DECLARE
    old_data jsonb;
    new_data jsonb;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'loading' THEN
            RAISE EXCEPTION 'Pokemon data versions must begin in loading state';
        END IF;
        RETURN NEW;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Pokemon data versions are immutable';
    END IF;
    old_data := to_jsonb(OLD) - 'status';
    new_data := to_jsonb(NEW) - 'status';
    IF OLD.status = 'loading' AND NEW.status = 'loaded' AND old_data = new_data THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Pokemon data versions are immutable except when sealing loading data';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pokemon_data_dataversion_state_guard
BEFORE INSERT OR UPDATE OR DELETE ON pokemon_data_dataversion
FOR EACH ROW EXECUTE FUNCTION pokemon_data_guard_version_state();

CREATE FUNCTION pokemon_data_guard_owned_mutation() RETURNS trigger AS $$
DECLARE
    row_data jsonb;
    owner_version varchar(100);
    new_owner_version varchar(100);
    owner_status varchar(16);
BEGIN
    row_data := CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) ELSE to_jsonb(OLD) END;
    CASE TG_TABLE_NAME
    WHEN 'pokemon_data_regulationmembership' THEN
        SELECT version_id INTO owner_version FROM pokemon_data_pokemonprofile
        WHERE id = (row_data->>'profile_id')::uuid;
    WHEN 'pokemon_data_pokemonprofiletype' THEN
        SELECT version_id INTO owner_version FROM pokemon_data_pokemonprofile
        WHERE id = (row_data->>'profile_id')::uuid;
    WHEN 'pokemon_data_pokemonprofileability' THEN
        SELECT version_id INTO owner_version FROM pokemon_data_pokemonprofile
        WHERE id = (row_data->>'profile_id')::uuid;
    WHEN 'pokemon_data_moveflagrelation' THEN
        SELECT version_id INTO owner_version FROM pokemon_data_moveprofile
        WHERE id = (row_data->>'move_profile_id')::uuid;
    WHEN 'pokemon_data_learnsetentry' THEN
        SELECT version_id INTO owner_version FROM pokemon_data_pokemonprofile
        WHERE id = (row_data->>'profile_id')::uuid;
    ELSE
        owner_version := row_data->>'version_id';
    END CASE;
    SELECT status INTO owner_status FROM pokemon_data_dataversion WHERE id = owner_version;
    IF owner_status IS DISTINCT FROM 'loading' THEN
        RAISE EXCEPTION 'sealed Pokemon data rows are immutable';
    END IF;
    IF TG_OP = 'UPDATE' THEN
        row_data := to_jsonb(NEW);
        CASE TG_TABLE_NAME
        WHEN 'pokemon_data_regulationmembership' THEN
            SELECT version_id INTO new_owner_version FROM pokemon_data_pokemonprofile
            WHERE id = (row_data->>'profile_id')::uuid;
        WHEN 'pokemon_data_pokemonprofiletype' THEN
            SELECT version_id INTO new_owner_version FROM pokemon_data_pokemonprofile
            WHERE id = (row_data->>'profile_id')::uuid;
        WHEN 'pokemon_data_pokemonprofileability' THEN
            SELECT version_id INTO new_owner_version FROM pokemon_data_pokemonprofile
            WHERE id = (row_data->>'profile_id')::uuid;
        WHEN 'pokemon_data_moveflagrelation' THEN
            SELECT version_id INTO new_owner_version FROM pokemon_data_moveprofile
            WHERE id = (row_data->>'move_profile_id')::uuid;
        WHEN 'pokemon_data_learnsetentry' THEN
            SELECT version_id INTO new_owner_version FROM pokemon_data_pokemonprofile
            WHERE id = (row_data->>'profile_id')::uuid;
        ELSE
            new_owner_version := row_data->>'version_id';
        END CASE;
        SELECT status INTO owner_status FROM pokemon_data_dataversion
        WHERE id = new_owner_version;
        IF owner_status IS DISTINCT FROM 'loading' THEN
            RAISE EXCEPTION 'rows cannot be reparented into sealed Pokemon data';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""
    + "\n".join(
        f"CREATE TRIGGER {table}_immutable BEFORE INSERT OR UPDATE OR DELETE ON {table} "
        "FOR EACH ROW EXECUTE FUNCTION pokemon_data_guard_owned_mutation();"
        for table in VERSION_OWNED_TABLES
    )
    + """

CREATE FUNCTION pokemon_data_reject_audit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Pokemon data activation audit rows are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER pokemon_data_dataactivation_immutable
BEFORE UPDATE OR DELETE ON pokemon_data_dataactivation
FOR EACH ROW EXECUTE FUNCTION pokemon_data_reject_audit_mutation();
"""
)

DROP_IMMUTABILITY_GUARDS = (
    "\n".join(
        f"DROP TRIGGER IF EXISTS {table}_immutable ON {table};" for table in VERSION_OWNED_TABLES
    )
    + """
DROP TRIGGER IF EXISTS pokemon_data_dataversion_state_guard ON pokemon_data_dataversion;
DROP TRIGGER IF EXISTS pokemon_data_dataactivation_immutable ON pokemon_data_dataactivation;
DROP FUNCTION IF EXISTS pokemon_data_guard_owned_mutation();
DROP FUNCTION IF EXISTS pokemon_data_guard_version_state();
DROP FUNCTION IF EXISTS pokemon_data_reject_audit_mutation();
"""
)

CREATE_VERSION_GUARDS = """
CREATE FUNCTION pokemon_data_assert_version_local() RETURNS trigger AS $$
DECLARE
    left_version varchar(100);
    right_version varchar(100);
    third_version varchar(100);
    left_regulation uuid;
    right_regulation uuid;
    base_dex integer;
    mega_dex integer;
    base_marker boolean;
    mega_marker boolean;
    mega_base uuid;
BEGIN
    CASE TG_TABLE_NAME
    WHEN 'pokemon_data_regulation' THEN
        SELECT version_id INTO right_version FROM pokemon_data_mechanicsprofile
        WHERE id = NEW.mechanics_profile_id;
        left_version := NEW.version_id;
    WHEN 'pokemon_data_pokemonform' THEN
        SELECT version_id, national_dex_number, is_mega
        INTO right_version, base_dex, base_marker FROM pokemon_data_pokemonform
        WHERE id = NEW.base_form_id;
        left_version := NEW.version_id;
        IF base_dex <> NEW.national_dex_number OR base_marker IS NOT FALSE THEN
            RAISE EXCEPTION 'invalid base-form identity';
        END IF;
    WHEN 'pokemon_data_abilityprofile' THEN
        SELECT version_id INTO right_version FROM pokemon_data_regulation
        WHERE id = NEW.regulation_id;
        SELECT version_id INTO third_version FROM pokemon_data_ability
        WHERE id = NEW.ability_id;
        left_version := NEW.version_id;
    WHEN 'pokemon_data_moveprofile' THEN
        SELECT version_id INTO right_version FROM pokemon_data_regulation
        WHERE id = NEW.regulation_id;
        SELECT version_id INTO third_version FROM pokemon_data_move WHERE id = NEW.move_id;
        IF NEW.version_id <> (SELECT version_id FROM pokemon_data_type WHERE id = NEW.type_id) THEN
            RAISE EXCEPTION 'move profile type must belong to the same data version';
        END IF;
        left_version := NEW.version_id;
    WHEN 'pokemon_data_pokemonprofile' THEN
        SELECT version_id INTO right_version FROM pokemon_data_regulation
        WHERE id = NEW.regulation_id;
        SELECT version_id INTO third_version FROM pokemon_data_pokemonform WHERE id = NEW.form_id;
        left_version := NEW.version_id;
    WHEN 'pokemon_data_pokemonprofiletype' THEN
        SELECT version_id INTO left_version FROM pokemon_data_pokemonprofile
        WHERE id = NEW.profile_id;
        SELECT version_id INTO right_version FROM pokemon_data_type WHERE id = NEW.type_id;
    WHEN 'pokemon_data_pokemonprofileability' THEN
        SELECT version_id, regulation_id INTO left_version, left_regulation
        FROM pokemon_data_pokemonprofile WHERE id = NEW.profile_id;
        SELECT version_id, regulation_id INTO right_version, right_regulation
        FROM pokemon_data_abilityprofile WHERE id = NEW.ability_profile_id;
        IF left_regulation <> right_regulation THEN
            RAISE EXCEPTION 'profile ability must belong to the same regulation';
        END IF;
    WHEN 'pokemon_data_moveflagrelation' THEN
        SELECT version_id INTO left_version FROM pokemon_data_moveprofile
        WHERE id = NEW.move_profile_id;
        SELECT version_id INTO right_version FROM pokemon_data_moveflag WHERE id = NEW.flag_id;
    WHEN 'pokemon_data_megarelation' THEN
        SELECT version_id, national_dex_number, is_mega INTO right_version, base_dex, base_marker
        FROM pokemon_data_pokemonform WHERE id = NEW.base_form_id;
        SELECT version_id, national_dex_number, is_mega, base_form_id
        INTO third_version, mega_dex, mega_marker, mega_base
        FROM pokemon_data_pokemonform WHERE id = NEW.mega_form_id;
        left_version := NEW.version_id;
        IF base_dex <> mega_dex OR base_marker IS NOT FALSE OR mega_marker IS NOT TRUE
            OR mega_base <> NEW.base_form_id THEN
            RAISE EXCEPTION 'invalid Mega relation form identities';
        END IF;
    WHEN 'pokemon_data_learnsetentry' THEN
        SELECT version_id, regulation_id INTO left_version, left_regulation
        FROM pokemon_data_pokemonprofile WHERE id = NEW.profile_id;
        SELECT version_id, regulation_id INTO right_version, right_regulation
        FROM pokemon_data_moveprofile WHERE id = NEW.move_profile_id;
        SELECT version_id INTO third_version FROM pokemon_data_pokemonform
        WHERE id = NEW.source_form_id;
        IF left_regulation <> right_regulation THEN
            RAISE EXCEPTION 'learnset move must belong to the same regulation';
        END IF;
    WHEN 'pokemon_data_spritemapping' THEN
        SELECT version_id INTO right_version FROM pokemon_data_pokemonform WHERE id = NEW.form_id;
        left_version := NEW.version_id;
    WHEN 'pokemon_data_sprite' THEN
        SELECT version_id INTO right_version FROM pokemon_data_spritemapping
        WHERE id = NEW.mapping_id;
        left_version := NEW.version_id;
    ELSE
        RAISE EXCEPTION 'unexpected Pokemon data version guard table: %', TG_TABLE_NAME;
    END CASE;
    IF left_version IS NULL OR right_version IS NULL OR left_version <> right_version THEN
        RAISE EXCEPTION 'related Pokemon data records must belong to the same version';
    END IF;
    IF third_version IS NOT NULL AND left_version <> third_version THEN
        RAISE EXCEPTION 'related Pokemon data records must belong to the same version';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
""" + "\n".join(
    f"CREATE CONSTRAINT TRIGGER {table}_version_local AFTER INSERT OR UPDATE ON {table} "
    "DEFERRABLE INITIALLY DEFERRED FOR EACH ROW "
    "EXECUTE FUNCTION pokemon_data_assert_version_local();"
    for table in VERSION_GUARD_TABLES
)

DROP_VERSION_GUARDS = (
    "\n".join(
        f"DROP TRIGGER IF EXISTS {table}_version_local ON {table};"
        for table in VERSION_GUARD_TABLES
    )
    + "\nDROP FUNCTION IF EXISTS pokemon_data_assert_version_local();"
)


class Migration(migrations.Migration):
    dependencies = [("pokemon_data", "0001_initial")]

    operations = [
        migrations.RunSQL(CREATE_VERSION_GUARDS, DROP_VERSION_GUARDS),
        migrations.RunSQL(CREATE_IMMUTABILITY_GUARDS, DROP_IMMUTABILITY_GUARDS),
    ]
