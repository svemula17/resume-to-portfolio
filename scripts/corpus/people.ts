/**
 * Invented people. Three sizes, because a layout that works for a
 * one-page resume can break on the second page, and a two-column layout
 * with six skill groups stresses the sidebar differently from one with two.
 *
 * Names, employers and schools are made up. Any resemblance is accidental.
 */
import type { Person } from "./types";

export const PEOPLE: Person[] = [
  {
    id: "priya-short",
    size: "short",
    resume: {
      basics: {
        name: "Priya Raman",
        title: "Frontend Engineer",
        summary: "Frontend engineer with four years shipping accessible React applications.",
        email: "priya.raman@example.com",
        phone: "(415) 555-0134",
        location: "Oakland, CA",
        links: [{ label: "GitHub", url: "github.com/priyaraman" }],
      },
      experience: [
        {
          company: "Lumen Labs",
          role: "Frontend Engineer",
          location: "Remote",
          startDate: "Jan 2022",
          current: true,
          bullets: [
            "Rebuilt the checkout flow in React, lifting conversion by nine percent.",
            "Introduced visual regression testing across forty components.",
          ],
        },
        {
          company: "Bright Owl",
          role: "Junior Developer",
          location: "Oakland, CA",
          startDate: "Jun 2020",
          endDate: "Dec 2021",
          current: false,
          bullets: ["Maintained the marketing site and its content pipeline."],
        },
      ],
      education: [{ school: "San Jose State University", degree: "BS Computer Science", startDate: "2016", endDate: "2020" }],
      projects: [],
      skills: [
        { category: "Languages", items: ["TypeScript", "JavaScript", "CSS"] },
        { category: "Frameworks", items: ["React", "Next.js", "Vite"] },
      ],
      certifications: [],
    },
  },
  {
    id: "marcus-medium",
    size: "medium",
    resume: {
      basics: {
        name: "Marcus Adeyemi",
        title: "Site Reliability Engineer",
        summary:
          "SRE with seven years running production Kubernetes for payments and logistics platforms. Builds the tooling, then runs the on-call rotation that depends on it.",
        email: "marcus.adeyemi@example.com",
        phone: "312-555-0177",
        location: "Chicago, IL",
        links: [
          { label: "LinkedIn", url: "linkedin.com/in/marcus-adeyemi" },
          { label: "GitHub", url: "github.com/madeyemi" },
        ],
      },
      experience: [
        {
          company: "Northwind Freight",
          role: "Senior Site Reliability Engineer",
          location: "Chicago, IL",
          startDate: "Mar 2021",
          current: true,
          bullets: [
            "Cut p99 latency of the dispatch API by forty percent through connection pooling and cache tuning.",
            "Led the migration of sixty services from self-managed clusters to managed Kubernetes.",
            "Wrote the incident response runbook adopted across three engineering teams.",
          ],
        },
        {
          company: "Halcyon Pay",
          role: "Site Reliability Engineer",
          location: "Remote",
          startDate: "Aug 2018",
          endDate: "Feb 2021",
          current: false,
          bullets: [
            "Owned observability: Prometheus, Grafana and alert routing for a payments platform.",
            "Reduced monthly cloud spend by eighteen percent with rightsizing and spot capacity.",
          ],
        },
        {
          company: "Initech",
          role: "Systems Administrator",
          location: "Milwaukee, WI",
          startDate: "Jun 2016",
          endDate: "Jul 2018",
          current: false,
          bullets: ["Managed Linux fleet configuration with Ansible."],
        },
      ],
      education: [{ school: "University of Illinois Chicago", degree: "BS Information Technology", startDate: "2012", endDate: "2016" }],
      projects: [
        { name: "kube-drain", description: "A safer node drain with pod disruption awareness.", tech: ["Go", "Kubernetes"], url: "github.com/madeyemi/kube-drain" },
      ],
      skills: [
        { category: "Platform", items: ["Kubernetes", "Terraform", "AWS", "GCP"] },
        { category: "Observability", items: ["Prometheus", "Grafana", "OpenTelemetry"] },
        { category: "Languages", items: ["Go", "Python", "Bash"] },
      ],
      certifications: [
        { name: "Certified Kubernetes Administrator", issuer: "CNCF", date: "2022" },
        { name: "AWS Solutions Architect Associate", issuer: "Amazon", date: "2020" },
      ],
    },
  },
  {
    id: "elena-long",
    size: "long",
    resume: {
      basics: {
        name: "Elena Vasquez-Moreno",
        title: "Data Engineering Lead",
        summary:
          "Data engineering lead with eleven years building batch and streaming platforms in finance and healthcare. Manages a team of eight; still writes the hard parts.",
        email: "elena.vm@example.com",
        phone: "+1 646 555 0198",
        location: "New York, NY",
        links: [
          { label: "LinkedIn", url: "linkedin.com/in/elena-vasquez-moreno" },
          { label: "GitHub", url: "github.com/evasquez" },
          { label: "elenavm.dev", url: "elenavm.dev" },
        ],
      },
      experience: [
        {
          company: "Meridian Health",
          role: "Data Engineering Lead",
          location: "New York, NY",
          startDate: "Sep 2020",
          current: true,
          bullets: [
            "Lead a team of eight engineers building the clinical data platform on Spark and Delta Lake.",
            "Designed the streaming ingestion layer handling two billion events a day with exactly-once semantics.",
            "Brought the platform through HIPAA and SOC 2 audits with no findings.",
            "Established the data contract programme that cut downstream breakages by seventy percent.",
          ],
        },
        {
          company: "Argent Capital",
          role: "Senior Data Engineer",
          location: "New York, NY",
          startDate: "Jan 2017",
          endDate: "Aug 2020",
          current: false,
          bullets: [
            "Built the market data lake on S3 and Athena, replacing a vendor system at a fifth of the cost.",
            "Wrote the Airflow framework used by forty pipelines across the firm.",
            "Mentored four junior engineers, two of whom were promoted to senior.",
          ],
        },
        {
          company: "Cobalt Analytics",
          role: "Data Engineer",
          location: "Boston, MA",
          startDate: "Jun 2014",
          endDate: "Dec 2016",
          current: false,
          bullets: [
            "Migrated nightly ETL from stored procedures to Spark, cutting the batch window from nine hours to two.",
            "Introduced schema versioning for the warehouse.",
          ],
        },
        {
          company: "Beacon Software",
          role: "Software Engineer",
          location: "Boston, MA",
          startDate: "Jul 2012",
          endDate: "May 2014",
          current: false,
          bullets: ["Developed reporting features for a SaaS analytics product in Java."],
        },
      ],
      education: [
        { school: "Columbia University", degree: "MS Computer Science", field: "Data Systems", startDate: "2015", endDate: "2017" },
        { school: "Boston University", degree: "BS Computer Engineering", startDate: "2008", endDate: "2012", gpa: "3.7/4.0" },
      ],
      projects: [
        { name: "deltacheck", description: "Schema drift detection for Delta Lake tables with Slack alerts.", tech: ["Python", "Spark"], url: "github.com/evasquez/deltacheck" },
        { name: "pipeline-lint", description: "Static checks for Airflow DAGs: cycles, missing retries, unbounded parallelism.", tech: ["Python"] },
      ],
      skills: [
        { category: "Data", items: ["Spark", "Delta Lake", "Kafka", "Airflow", "dbt"] },
        { category: "Cloud", items: ["AWS", "Databricks", "Snowflake"] },
        { category: "Languages", items: ["Python", "Scala", "SQL", "Java"] },
        { category: "Leadership", items: ["Hiring", "Roadmapping", "Mentoring"] },
      ],
      certifications: [
        { name: "Databricks Certified Data Engineer Professional", issuer: "Databricks", date: "2023" },
        { name: "AWS Certified Data Analytics – Specialty", issuer: "Amazon", date: "2021" },
      ],
    },
  },
];
