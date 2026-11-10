# Importing listings

For bringing MTeam's own listings in from a spreadsheet. Only import listings MTeam has the right to publish.

1. Fill a sheet using the columns in `import-template.csv`, and save it from Excel as "CSV UTF-8".
2. Run this, with the phone number of the MTeam staff account that will own the listings:

   ```
   pnpm --filter @mteam/db db:import /full/path/to/file.csv 555123456
   ```

   Listings arrive as pending, to be approved one by one in the admin page. For a large file add `--publish` at the end to put them straight on the site, because rows already imported as pending cannot be published in bulk later. They are never marked verified, because that takes a broker's visit.

3. The command prints how many were created and names each bad row by its Excel row number and the column at fault. Fix those rows and run the same file again: rows already imported are skipped by their `ref`, and are not updated.

## Columns

- `ref` is required: the listing's number in the source system, unique within it.
- Any field of the posting form can be a column, and blank cells count as not given. Numbers may use a decimal comma. Required: `deal`, `type`, `city`, `address`, `title`, `description`, `price`, `currency`, `area`. `district` is required in cities that have districts, `rooms` for homes.
- City, district, street and metro must match the names on the site exactly, in Georgian.
- Fixed choices such as `condition` or `heating` use the keys in `packages/shared/src/details.ts`.
- `features` and `photos` hold several values separated by `|`. `photos` are web addresses of images already uploaded, at most 10.
- `agentPhone` is required: the listing's broker, who needs an account with the broker role and a name.

## After an import

Run `pnpm --filter @mteam/db db:market` to recalculate where each listing sits against the market. Districts need at least 5 comparable published listings to get a level.
