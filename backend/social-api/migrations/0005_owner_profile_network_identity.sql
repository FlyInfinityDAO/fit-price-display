-- Store the immutable Network Owner ID captured from the live contract.
-- This allows a wallet changed with _Change_Wallet to be linked back to
-- the same Owner Profile using the contract's owner-index mapping.
ALTER TABLE owner_profiles ADD COLUMN network_owner_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_profiles_network_owner_id
  ON owner_profiles(network_owner_id)
  WHERE network_owner_id IS NOT NULL;
