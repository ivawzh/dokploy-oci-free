# OCI Free Tier infra with self-hosted Dokploy Manager

This Pulumi project deploys a self-hosted Dokploy manager instance (including the UI) along with worker nodes on Oracle Cloud Infrastructure (OCI) Free Tier. **Dokploy** is an open-source platform to manage your app deployments and server configurations usually on VPS.

## Architecture Overview

The stack deploys a complete Dokploy environment consisting of:

- A main manager instance running the Dokploy UI and manager service
- Optional worker instances (default: 1) for running your workloads
- A secure network infrastructure with proper isolation and access controls

### OCI Components

1. **Virtual Cloud Network (VCN)**:
   - A dedicated network space with CIDR block `10.0.0.0/16`
   - Provides network isolation for your Dokploy infrastructure
   - Includes DNS label for internal name resolution

2. **Internet Gateway**:
   - Enables outbound internet access for instances
   - Allows inbound access to Dokploy UI and services
   - Connected to VCN via route table rules

3. **Subnet**:
   - CIDR block: `10.0.0.0/24`
   - Houses both manager and worker instances
   - Public subnet with auto-assigned public IPs

4. **Security List**:
   - Controls inbound/outbound traffic
   - Allows essential ports:
     - 3000: Dokploy UI access
     - 22: SSH access
     - 80/443: HTTP(S) traffic
     - 81/444: Traefik proxy ports
     - 2376/2377: Docker Swarm management
     - 7946, 4789: Docker Swarm overlay network
   - Permits all outbound traffic

5. **Compute Instances**:
   - **Manager Instance**:
     - Runs Dokploy UI and manager services
     - Default shape: VM.Standard.A1.Flex (ARM-based)
     - 6GB RAM, 1 OCPU (configurable)
     - Oracle Linux with cloud-init setup

   - **Worker Instances**:
     - Run your workloads and deployments
     - Same instance shape as manager
     - Configurable count (default: 1)
     - Automatically join Dokploy cluster

### How Dokploy Works

1. **Manager Node**:
   - Hosts the web UI on port 3000
   - Runs the Dokploy manager service
   - Manages the worker cluster
   - Handles deployment orchestration
   - Stores configuration and state

2. **Worker Nodes**:
   - Execute actual workloads
   - Run containerized applications
   - Handle application scaling
   - Report status back to manager

3. **Networking Flow**:
   - External users access Dokploy UI via manager's public IP
   - Manager communicates with workers via internal VCN network
   - Workers can pull from internet through Internet Gateway
   - Inter-node communication uses Docker Swarm overlay network

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

```sh
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
   pulumi stack init production

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
   bun preview

   # Deploy the stack
   bun deploy
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

## Security Considerations

1. **Network Security**:
   - All instances use public IPs for easy access
   - Security lists restrict access to necessary ports only
   - Consider using Bastion host for production
   - Enable only required ports for your use case

2. **Instance Security**:
   - SSH key-based authentication only
   - Regular system updates via cloud-init
   - Minimal required services enabled
   - Cloud Guard workload protection enabled

3. **Application Security**:
   - Dokploy UI protected by authentication
   - Worker nodes accessible only via manager
   - HTTPS recommended for production use
   - Regular security updates recommended

## Monitoring and Maintenance

1. **OCI Monitoring**:
   - Instance monitoring enabled by default
   - Custom logs monitoring available
   - Use OCI Console for resource metrics
   - Set up alarms for critical metrics

2. **Dokploy Monitoring**:
   - Built-in dashboard for deployment status
   - Worker node health monitoring
   - Deployment logs and history
   - Resource usage tracking

## Cleanup

To destroy the infrastructure:

```bash
bun destroy
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

4. **Network Connectivity**:
   - Verify security list rules
   - Check route table configuration
   - Ensure internet gateway is properly attached
   - Test internal network connectivity between nodes

## Additional Resources

- [Pulumi OCI Provider Documentation](https://www.pulumi.com/registry/packages/oci/)
- [OCI Free Tier Documentation](https://www.oracle.com/cloud/free/)
- [Dokploy Documentation](https://docs.dokploy.com/)
- [Docker Swarm Documentation](https://docs.docker.com/engine/swarm/)

## OCI Free Tier Resources

This project leverages Oracle Cloud Infrastructure's Always Free resources, which include:

### Compute Resources

- **Arm-based Ampere A1**:
  - 3,000 OCPU hours and 18,000 GB hours per month
  - Up to 4 VMs sharing 24 GB memory
  - Perfect for running Dokploy manager and workers
- **AMD-based Compute VMs**:
  - 2 VMs with 1/8 OCPU and 1 GB memory each
  - Alternative option for smaller workloads

### Networking

- **Virtual Cloud Networks (VCN)**:
  - 2 VCNs with IPv4 and IPv6 support
  - Sufficient for creating isolated networks
- **Load Balancer**:
  - 1 instance with 10 Mbps bandwidth
  - Useful for distributing traffic across workers
- **Outbound Data Transfer**:
  - Up to 10 TB per month
  - Generous allowance for container image pulls and application traffic

### Storage

- **Block Volume Storage**:
  - Up to 200 GB total across 2 block volumes
  - 5 volume backups included
  - Suitable for persistent data storage
- **Object Storage**:
  - 20 GB total across standard, infrequent, and archive tiers
  - 50,000 API requests per month
  - Useful for storing deployment artifacts

### Security

- **Bastion Service**:
  - Up to 5 OCI Bastions
  - Secure SSH access to private resources
- **Vault**:
  - 20 key versions for encryption
  - 150 secrets storage
  - Perfect for storing sensitive configuration

### Monitoring and Logging

- **Logging**:
  - Up to 10 GB per month
  - Useful for troubleshooting and audit
- **Monitoring**:
  - 500 million ingestion datapoints
  - 1 billion retrieval datapoints
  - Essential for system health monitoring

These resources are more than sufficient for running a production-grade Dokploy environment with multiple worker nodes.
