---
title: Install the Proxy CA
description: Trust TRAWL's generated root CA on operating systems, browsers, Java, and containers.
---

# Install the proxy CA

TRAWL decrypts proxied HTTPS connections to detect challenge pages. On first proxy startup it
creates:

- `ca.crt` - the root certificate clients install;
- `ca.key` - the private signing key, which must remain secret.

Both files live in `MITM_CA_DIR`. Per-host certificates are generated in memory and signed by
this root. Persist the directory so clients only need to install the root once.

## Upgrading an existing CA

On the first startup after upgrading to a version containing the fix for issue #113, TRAWL checks
the persisted root certificate. If it lacks a Subject Key Identifier, TRAWL updates `ca.crt` once
and logs the certificate path. The subject, serial number, validity period, and CA key stay the
same; `ca.key` is not changed. TRAWL refuses to migrate if the certificate and private key do not
match or an existing Subject Key Identifier is invalid, rather than silently creating a new CA
identity. Initialization is serialized with a short-lived `.ca.lock` file so multiple instances
sharing the same CA volume cannot race to create different identities. If a process is forcibly
terminated during initialization, remove a stale lock only after confirming no other instance is
starting.

Adding the extension changes the certificate fingerprint. Clients that pin the exact certificate,
including strict TLS clients, must download the updated `ca.crt`, remove the previously installed
TRAWL root, and import the updated certificate using the relevant instructions below. Restart the
client afterward if it caches its trust store. Clients that identify trust anchors by their public
key and subject may continue to work without re-importing, but updating every trust store is the
safest deployment procedure.

::: danger
Anyone with `ca.key` can issue certificates trusted by clients that installed this CA. Keep the
directory private, do not publish it, and never distribute `ca.key`.
:::

## Download the certificate

The route is available when the proxy is enabled:

```bash
curl http://<trawl-host>:8191/proxy-ca.crt -o trawl-ca.crt
```

From the TRAWL container:

```bash
docker cp trawl:/data/proxy-ca/ca.crt ./trawl-ca.crt
```

## macOS

Install into the system keychain:

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain ./trawl-ca.crt
```

Verify or remove it:

```bash
security find-certificate -c "TRAWL MITM Proxy CA"
sudo security delete-certificate -c "TRAWL MITM Proxy CA" \
  /Library/Keychains/System.keychain
```

## Debian and Ubuntu

```bash
sudo cp trawl-ca.crt /usr/local/share/ca-certificates/trawl-ca.crt
sudo update-ca-certificates
```

## RHEL, Fedora, and Amazon Linux

```bash
sudo cp trawl-ca.crt /etc/pki/ca-trust/source/anchors/trawl-ca.crt
sudo update-ca-trust
```

## Windows

Run PowerShell as Administrator:

```powershell
Import-Certificate -FilePath .\trawl-ca.crt `
  -CertStoreLocation Cert:\LocalMachine\Root
```

Remove it later:

```powershell
Get-ChildItem Cert:\LocalMachine\Root |
  Where-Object { $_.Subject -like "*TRAWL MITM*" } |
  Remove-Item
```

## Firefox and NSS stores

Firefox installations that do not use the operating-system roots need an NSS import:

```bash
certutil -A -n "TRAWL MITM" -t "CT,C,C" -i trawl-ca.crt \
  -d sql:$HOME/.mozilla/firefox/<profile-directory>
```

Alternatively use **Settings → Privacy & Security → Certificates → View Certificates →
Authorities → Import**.

## Java and JDownloader

Java applications use their own `cacerts` store:

```bash
keytool -importcert -noprompt -trustcacerts \
  -alias trawl-mitm-ca \
  -file trawl-ca.crt \
  -keystore "<java-home>/lib/security/cacerts" \
  -storepass changeit
```

JDownloader bundles a JRE. Locate its active Java path in JDownloader's advanced settings, import
the certificate into that JRE's `lib/security/cacerts`, and restart JDownloader.

Prowlarr, Sonarr, and Radarr are .NET applications. Their containers normally use the Linux system
trust store, not Java `cacerts`.

## Docker clients

Mount the certificate into the client container and install it during container initialization.
For Debian-based images:

```bash
cp /config/trawl-ca.crt /usr/local/share/ca-certificates/trawl-ca.crt
update-ca-certificates
```

The exact startup-hook directory depends on the image. LinuxServer images support
`/custom-cont-init.d/`; other images may require a derived Dockerfile.

## Rotation and recovery

Do not delete or replace `ca.crt` or `ca.key` during normal upgrades. TRAWL only generates a new
root when both files are absent. If just one file is missing, startup fails to prevent an accidental
identity change. If both are lost, TRAWL generates a new root on the next startup and every client
must install the new certificate.

To intentionally rotate the CA:

1. stop TRAWL;
2. back up and remove both CA files;
3. start TRAWL and download the new `ca.crt`;
4. remove the old root from every client;
5. install the new root.
