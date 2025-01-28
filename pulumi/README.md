# Dokploy Deployment on OCI Free Tier using Pulumi

This Pulumi project deploys a Dokploy instance along with worker nodes in Oracle Cloud Infrastructure (OCI) Free Tier. **Dokploy** is an open-source platform to manage your app deployments and server configurations.

## Prerequisites

Before you begin, ensure you have the following:

1. **OCI Setup**:
   - An Oracle Cloud Infrastructure (OCI) account with Free Tier resources available
   - OCI CLI installed and configured ([OCI CLI Installation Guide](https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm))
   - Your OCI config file at `~/.oci/config` with proper credentials
   - Required OCI information:
     - Compartment ID
     - Availability Domains
     - Source Image ID (Oracle Linux)
     - SSH public key

2. **Pulumi Setup**:
   - Node.js 16.x or later installed
   - Pulumi CLI installed ([Installation Guide](https://www.pulumi.com/docs/install/))
   - A Pulumi account and logged in via `pulumi login`

## Project Structure

```
pulumi/
├── index.ts              # Main Pulumi program
├── package.json          # Node.js dependencies
├── tsconfig.json         # TypeScript configuration
├── Pulumi.yaml          # Pulumi project file
└── Pulumi.dev.yaml      # Stack configuration file
```

## Getting Started

1. **Clone and Setup**:
   ```bash
   # Clone the repository
   git clone https://github.com/your-repo/dokploy-oci-free
   cd dokploy-oci-free/pulumi

   # Install dependencies
   npm install
   ```

2. **Configure Pulumi Stack**:
   ```bash
   # Create a new stack
   pulumi stack init dev

   # Configure required variables
   pulumi config set oci:tenancyOcid <your-tenancy-ocid>
   pulumi config set oci:userOcid <your-user-ocid>
   pulumi config set oci:fingerprint <your-key-fingerprint>
   pulumi config set oci:region <your-region>
   pulumi config set oci:privateKey <path-to-private-key>

   # Set project specific configs
   pulumi config set compartmentId <your-compartment-id>
   pulumi config set sourceImageId <oracle-linux-image-id>
   pulumi config set availabilityDomainMain <main-ad>
   pulumi config set availabilityDomainWorkers <workers-ad>
   pulumi config set sshAuthorizedKeys <your-ssh-public-key>

   # Optional configurations with defaults
   pulumi config set numWorkerInstances 1
   pulumi config set instanceShape VM.Standard.A1.Flex
   pulumi config set memoryInGbs 6
   pulumi config set ocpus 1
   ```

3. **Preview and Deploy**:
   ```bash
   # Preview the changes
   npm run preview

   # Deploy the stack
   npm run deploy
   ```

4. **Access Your Deployment**:
   After successful deployment, Pulumi will output:
   - Main instance public IP
   - Worker instances public IPs
   - VCN ID
   - Subnet ID

## Post-Deployment Setup

### Setting up Dokploy

1. **Access Dokploy Dashboard**:
   - Wait a few minutes after deployment for the installation to complete
   - Access the dashboard via `http://<main-instance-public-ip>:3000`
   - Follow the initial setup wizard to create your admin account

2. **Configure Worker Nodes**:
   1. Generate SSH Keys in Dokploy:
      - Navigate to "SSH Keys" in the dashboard
      - Add your private and public SSH keys

   2. Add Servers:
      - Go to "Servers" section
      - Click "Add Server"
      - For each worker:
        - Name: Give a meaningful name
        - IP: Use the worker's public IP
        - Username: Use 'root'
        - Select the SSH key you added

3. **Configure Dokploy Cluster**:
   - Follow the [Dokploy Cluster Documentation](https://docs.dokploy.com/en/docs/core/server/cluster)
   - Add worker nodes to your cluster using the provided IPs

## Cleanup

To destroy the infrastructure:
```bash
bun run destroy
```

## Troubleshooting

1. **OCI Capacity Issues**:
   - Free Tier instances might face "Out of Capacity" errors
   - Try deploying in different availability domains
   - Consider upgrading to a paid account while keeping free tier benefits

2. **SSH Access Issues**:
   - Verify your SSH key is correctly configured in Pulumi config
   - Check security list rules in OCI console
   - Ensure instance is fully provisioned

3. **Dokploy Installation Issues**:
   - Check instance logs: `sudo journalctl -u cloud-init`
   - Verify cloud-init script execution
   - Check if all required ports are open in security lists

## Additional Resources

- [Pulumi OCI Provider Documentation](https://www.pulumi.com/registry/packages/oci/)
- [OCI Free Tier Documentation](https://www.oracle.com/cloud/free/)
- [Dokploy Documentation](https://docs.dokploy.com/)
