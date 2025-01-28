import * as pulumi from '@pulumi/pulumi'
import * as oci from '@pulumi/oci'
import * as fs from 'node:fs'

const config = new pulumi.Config()

// Configuration variables
const sshAuthorizedKeys = config.require('sshAuthorizedKeys')
const compartmentId = config.require('compartmentId')
const sourceImageId = config.require('sourceImageId')
const numWorkerInstances = config.getNumber('numWorkerInstances') ?? 1
const availabilityDomainMain = config.require('availabilityDomainMain')
const availabilityDomainWorkers = config.require('availabilityDomainWorkers')
const instanceShape = config.get('instanceShape') ?? 'VM.Standard.A1.Flex'
const memoryInGbs = config.get('memoryInGbs') ?? '6'
const ocpus = config.get('ocpus') ?? '1'

// Generate a random string for resource naming
const resourceCode = Math.random().toString(36).substring(2, 8)

// Network configuration
const vcn = new oci.core.Vcn('dokployVcn', {
  compartmentId,
  cidrBlock: '10.0.0.0/16',
  displayName: `network-dokploy-${resourceCode}`,
  dnsLabel: `vcn${resourceCode}`
})

const internetGateway = new oci.core.InternetGateway('dokployInternetGateway', {
  compartmentId,
  displayName: 'Internet Gateway network-dokploy',
  enabled: true,
  vcnId: vcn.id
})

const defaultRouteTable = new oci.core.DefaultRouteTable('dokployDefaultRouteTable', {
  manageDefaultResourceId: vcn.defaultRouteTableId,
  routeRules: [{
    destination: '0.0.0.0/0',
    destinationType: 'CIDR_BLOCK',
    networkEntityId: internetGateway.id
  }]
})

// Security list configuration
const securityList = new oci.core.SecurityList('dokploySecurityList', {
  compartmentId,
  vcnId: vcn.id,
  displayName: 'Dokploy Security List',
  ingressSecurityRules: [
    {
      protocol: '6',
      source: '0.0.0.0/0',
      tcpOptions: { min: 3000, max: 3000 },
      description: 'Allow HTTP traffic for Dokploy on port 3000'
    },
    {
      protocol: '6',
      source: '0.0.0.0/0',
      tcpOptions: { min: 22, max: 22 },
      description: 'Allow SSH traffic on port 22'
    },
    {
      protocol: '6',
      source: '0.0.0.0/0',
      tcpOptions: { min: 80, max: 80 },
      description: 'Allow HTTP traffic on port 80'
    },
    {
      protocol: '6',
      source: '0.0.0.0/0',
      tcpOptions: { min: 443, max: 443 },
      description: 'Allow HTTPS traffic on port 443'
    },
    {
      protocol: '1',
      source: '0.0.0.0/0',
      icmpOptions: { type: 3, code: 4 },
      description: 'ICMP traffic for 3, 4'
    },
    {
      protocol: '1',
      source: '10.0.0.0/16',
      icmpOptions: { type: 3, code: -1 },
      description: 'ICMP traffic for 3'
    },
    {
      protocol: '6',
      source: '0.0.0.0/0',
      tcpOptions: { min: 81, max: 81 },
      description: 'Allow Traefik HTTP traffic on port 81'
    },
    {
      protocol: '6',
      source: '0.0.0.0/0',
      tcpOptions: { min: 444, max: 444 },
      description: 'Allow Traefik HTTPS traffic on port 444'
    },
    {
      protocol: '6',
      source: '0.0.0.0/0',
      tcpOptions: { min: 2376, max: 2376 },
      description: 'Allow Docker Swarm traffic on port 2376'
    },
    {
      protocol: '6',
      source: '0.0.0.0/0',
      tcpOptions: { min: 2377, max: 2377 },
      description: 'Allow Docker Swarm traffic on port 2377'
    },
    {
      protocol: '6',
      source: '0.0.0.0/0',
      tcpOptions: { min: 7946, max: 7946 },
      description: 'Allow Docker Swarm traffic on port 7946'
    },
    {
      protocol: '17',
      source: '0.0.0.0/0',
      udpOptions: { min: 7946, max: 7946 },
      description: 'Allow Docker Swarm UDP traffic on port 7946'
    },
    {
      protocol: '17',
      source: '0.0.0.0/0',
      udpOptions: { min: 4789, max: 4789 },
      description: 'Allow Docker Swarm UDP traffic on port 4789'
    }
  ],
  egressSecurityRules: [{
    protocol: 'all',
    destination: '0.0.0.0/0',
    description: 'Allow all egress traffic'
  }]
})

// Subnet configuration
const subnet = new oci.core.Subnet('dokploySubnet', {
  compartmentId,
  vcnId: vcn.id,
  cidrBlock: '10.0.0.0/24',
  displayName: `subnet-dokploy-${resourceCode}`,
  dnsLabel: `subnet${resourceCode}`,
  routeTableId: vcn.defaultRouteTableId,
  securityListIds: [securityList.id]
})

// Instance configuration
const instanceConfig = {
  isPvEncryptionInTransitEnabled: true,
  shape: instanceShape,
  availabilityConfig: {
    recoveryAction: 'RESTORE_INSTANCE'
  },
  instanceOptions: {
    areLegacyImdsEndpointsDisabled: false
  },
  shapeConfig: {
    memoryInGbs: Number.parseInt(memoryInGbs),
    ocpus: Number.parseInt(ocpus)
  },
  sourceDetails: {
    sourceId: sourceImageId,
    sourceType: 'image'
  }
}

// Main instance
const mainInstance = new oci.core.Instance('dokployMain', {
  displayName: `dokploy-main-${resourceCode}`,
  compartmentId,
  availabilityDomain: availabilityDomainMain,
  isPvEncryptionInTransitEnabled: instanceConfig.isPvEncryptionInTransitEnabled,
  shape: instanceConfig.shape,
  metadata: {
    sshAuthorizedKeys,
    userData: Buffer.from(fs.readFileSync('./bin/dokploy-main.sh').toString()).toString('base64')
  },
  createVnicDetails: {
    displayName: `dokploy-main-${resourceCode}`,
    subnetId: subnet.id,
    skipSourceDestCheck: false,
    assignPublicIp: 'true'
  },
  availabilityConfig: instanceConfig.availabilityConfig,
  instanceOptions: instanceConfig.instanceOptions,
  shapeConfig: instanceConfig.shapeConfig,
  sourceDetails: instanceConfig.sourceDetails,
  agentConfig: {
    areAllPluginsDisabled: false,
    isManagementDisabled: false,
    isMonitoringDisabled: false,
    pluginsConfigs: [
      { desiredState: 'DISABLED', name: 'Vulnerability Scanning' },
      { desiredState: 'DISABLED', name: 'Management Agent' },
      { desiredState: 'ENABLED', name: 'Custom Logs Monitoring' },
      { desiredState: 'DISABLED', name: 'Compute RDMA GPU Monitoring' },
      { desiredState: 'ENABLED', name: 'Compute Instance Monitoring' },
      { desiredState: 'DISABLED', name: 'Compute HPC RDMA Auto-Configuration' },
      { desiredState: 'DISABLED', name: 'Compute HPC RDMA Authentication' },
      { desiredState: 'ENABLED', name: 'Cloud Guard Workload Protection' },
      { desiredState: 'DISABLED', name: 'Block Volume Management' },
      { desiredState: 'DISABLED', name: 'Bastion' }
    ]
  }
})

// Worker instances
const workerInstances = Array.from({ length: numWorkerInstances }).map((_, index) => {
  return new oci.core.Instance(`dokployWorker${index + 1}`, {
    displayName: `dokploy-worker-${index + 1}-${resourceCode}`,
    compartmentId,
    availabilityDomain: availabilityDomainWorkers,
    isPvEncryptionInTransitEnabled: instanceConfig.isPvEncryptionInTransitEnabled,
    shape: instanceConfig.shape,
    metadata: {
      sshAuthorizedKeys,
      userData: Buffer.from(fs.readFileSync('./bin/dokploy-worker.sh').toString()).toString('base64')
    },
    createVnicDetails: {
      displayName: `dokploy-worker-${index + 1}-${resourceCode}`,
      subnetId: subnet.id,
      skipSourceDestCheck: false,
      assignPublicIp: 'true'
    },
    availabilityConfig: instanceConfig.availabilityConfig,
    instanceOptions: instanceConfig.instanceOptions,
    shapeConfig: instanceConfig.shapeConfig,
    sourceDetails: instanceConfig.sourceDetails,
    agentConfig: {
      areAllPluginsDisabled: false,
      isManagementDisabled: false,
      isMonitoringDisabled: false,
      pluginsConfigs: [
        { desiredState: 'DISABLED', name: 'Vulnerability Scanning' },
        { desiredState: 'DISABLED', name: 'Management Agent' },
        { desiredState: 'ENABLED', name: 'Custom Logs Monitoring' },
        { desiredState: 'DISABLED', name: 'Compute RDMA GPU Monitoring' },
        { desiredState: 'ENABLED', name: 'Compute Instance Monitoring' },
        { desiredState: 'DISABLED', name: 'Compute HPC RDMA Auto-Configuration' },
        { desiredState: 'DISABLED', name: 'Compute HPC RDMA Authentication' },
        { desiredState: 'ENABLED', name: 'Cloud Guard Workload Protection' },
        { desiredState: 'DISABLED', name: 'Block Volume Management' },
        { desiredState: 'DISABLED', name: 'Bastion' }
      ]
    }
  })
})

// Export outputs
export const mainInstancePublicIp = mainInstance.publicIp
export const workerInstancePublicIps = workerInstances.map(instance => instance.publicIp)
export const vcnId = vcn.id
export const subnetId = subnet.id
