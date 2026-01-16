// @ts-nocheck
// AUTO-GENERATED - HL7v2 DataType Interfaces and Segment Builders
// Generated for: BAR_P01, ORU_R01

import type { HL7v2Segment, FieldValue } from "./types";
import { getComponent } from "./types";
import { AcceptApplicationAcknowledgmentConditions, AdditivePreservative, AdministrativeSex, AdmissionLevelOfCare, AdmissionType, AdvanceDirective, AdvancedBeneficiaryNotice, AllergenType, AllergySeverity, AlternateCharacterSetHandlingScheme, AlternateCharacterSets, AmbulatoryStatus, ArrivalMode, AssignmentOfBenefits, AuthorizationMode, BedStatus, ClergyNotificationType, CommentType, ConfidentialityCodes, ContactRole2, ContainerCondition, ContinuationStyle, CoordinationOfBenefits, CoverageType, CyclicEntryExitIndicator, DiagnosisClassification, DiagnosisPriority, DiagnosisType, DiagnosticServiceSectionId, DisabilityInformationRelationship, DrgTransferType, EligibilitySource, EmploymentStatus, EscortRequired, EthnicGroup, Event, EventReason, ExtendedPriorityCodes, HospitalService, IdentifierType, IdentityReliability, ImmunizationRegistryStatus, InsuranceCompanyContactReason, JobStatus, LivingArrangement, LivingDependency2, LivingWillCodes, MailClaimParty, MaritalStatus, MilitaryService, MilitaryStatus, NatureOfAbnormalTesting, ObservationResultHandling, ObservationResultStatusCodesInterpretation, OrderControlCodes, OrderStatus, OrderType, OrganDonorCodes, OrganizationUnitType, OutlierType, PHRaceAndEthnicityCDC, PatientClass, PatientCondition, PatientStatus, PatientsRelationshipToInsured, Precaution, PreferredMethodOfContact, ProblemGoalAction, ProcedureDrgType, ProcedureFunctionalType, ProcedurePriority, ProductionClass, ProviderRole, Publicity, PurgeStatus, ReAdmissionIndicator, RecreationalDrugType, Relationship, Religion2, RepeatPattern, ResponseFlag, ResultStatus, RiskManagementIncident, Risks, SegmentAction, SequenceCondition, SequenceResultsFlag, ServiceRequestRelationship, SignatureType, SourceOfComment, SpecialHandling, SpecialProgram, SpecimenAction, SpecimenAppropriateness, SpecimenChildRole, SpecimenCollectionMethod, SpecimenCondition, SpecimenQuality, SpecimenRejectReason, SpecimenRole, SpecimenType, StudentStatus, TissueType, TransactionType, TransportArranged, TransportationMode, TypeOfAgreement, VisitIndicator, VisitPriority, VisitUserCodes } from "./tables";

// ====== DataType Interfaces ======

/** AUI DataType */
export interface AUI {
  /** AUI.1 - Authorization Number */
  $1_authorization?: string;
  /** AUI.2 - Date */
  $2_date?: string;
  /** AUI.3 - Source */
  $3_source?: string;
}

/** CE DataType */
export interface CE {
  /** CE.1 - Identifier */
  $1_code?: string;
  /** CE.2 - Text */
  $2_text?: string;
  /** CE.3 - Name of Coding System */
  $3_system?: string;
  /** CE.4 - Alternate Identifier */
  $4_altCode?: string;
  /** CE.5 - Alternate Text */
  $5_altDisplay?: string;
  /** CE.6 - Name of Alternate Coding System */
  $6_altSystem?: string;
}

/** CNE DataType */
export interface CNE {
  /** CNE.1 - Identifier */
  $1_code?: string;
  /** CNE.2 - Text */
  $2_text?: string;
  /** CNE.3 - Name of Coding System */
  $3_system?: string;
  /** CNE.4 - Alternate Identifier */
  $4_altCode?: string;
  /** CNE.5 - Alternate Text */
  $5_altDisplay?: string;
  /** CNE.6 - Name of Alternate Coding System */
  $6_altSystem?: string;
  /** CNE.7 - Coding System Version ID */
  $7_version?: string;
  /** CNE.8 - Alternate Coding System Version ID */
  $8_altVersion?: string;
  /** CNE.9 - Original Text */
  $9_originalText?: string;
}

/** CNN DataType */
export interface CNN {
  /** CNN.1 - ID Number */
  $1_value?: string;
  /** CNN.2 - Family Name */
  $2_family?: string;
  /** CNN.3 - Given Name */
  $3_given?: string;
  /** CNN.4 - Second and Further Given Names or Initials Thereof */
  $4_additionalGiven?: string;
  /** CNN.5 - Suffix (e.g., JR or III) */
  $5_suffix?: string;
  /** CNN.6 - Prefix (e.g., DR) */
  $6_prefix?: string;
  /** CNN.7 - Degree (e.g., MD */
  $7_qualification?: string;
  /** CNN.8 - Source Table */
  $8_sourceTable?: string;
  /** CNN.9 - Assigning Authority   - Namespace ID */
  $9_systemNamespace?: string;
  /** CNN.10 - Assigning Authority  - Universal ID */
  $10_systemId?: string;
  /** CNN.11 - Assigning Authority  - Universal ID Type */
  $11_systemType?: string;
}

/** CP DataType */
export interface CP {
  /** CP.1 - Price */
  $1_amount?: MO;
  /** CP.2 - Price Type */
  $2_priceType?: string;
  /** CP.3 - From Value */
  $3_low?: string;
  /** CP.4 - To Value */
  $4_high?: string;
  /** CP.5 - Range Units */
  $5_unit?: CE;
  /** CP.6 - Range Type */
  $6_rangeType?: string;
}

/** CQ DataType */
export interface CQ {
  /** CQ.1 - Quantity */
  $1_value?: string;
  /** CQ.2 - Units */
  $2_unit?: CE;
}

/** CWE DataType */
export interface CWE {
  /** CWE.1 - Identifier */
  $1_code?: string;
  /** CWE.2 - Text */
  $2_text?: string;
  /** CWE.3 - Name of Coding System */
  $3_system?: string;
  /** CWE.4 - Alternate Identifier */
  $4_altCode?: string;
  /** CWE.5 - Alternate Text */
  $5_altDisplay?: string;
  /** CWE.6 - Name of Alternate Coding System */
  $6_altSystem?: string;
  /** CWE.7 - Coding System Version ID */
  $7_version?: string;
  /** CWE.8 - Alternate Coding System Version ID */
  $8_altVersion?: string;
  /** CWE.9 - Original Text */
  $9_originalText?: string;
}

/** CX DataType */
export interface CX {
  /** CX.1 - ID Number */
  $1_value?: string;
  /** CX.2 - Check Digit */
  $2_checkDigit?: string;
  /** CX.3 - Check Digit Scheme */
  $3_checkDigitScheme?: string;
  /** CX.4 - Assigning Authority */
  $4_system?: HD;
  /** CX.5 - Identifier Type Code */
  $5_type?: string;
  /** CX.6 - Assigning Facility */
  $6_assigner?: HD;
  /** CX.7 - Effective Date */
  $7_start?: string;
  /** CX.8 - Expiration Date */
  $8_end?: string;
  /** CX.9 - Assigning Jurisdiction */
  $9_jurisdiction?: CWE;
  /** CX.10 - Assigning Agency or Department */
  $10_department?: CWE;
}

/** DDI DataType */
export interface DDI {
  /** DDI.1 - Delay Days */
  $1_delay?: string;
  /** DDI.2 - Monetary Amount */
  $2_amount?: MO;
  /** DDI.3 - Number of Days */
  $3_days?: string;
}

/** DLD DataType */
export interface DLD {
  /** DLD.1 - Discharge Location */
  $1_location?: string;
  /** DLD.2 - Effective Date */
  $2_start?: string;
}

/** DLN DataType */
export interface DLN {
  /** DLN.1 - License Number */
  $1_license?: string;
  /** DLN.2 - Issuing State, Province, Country */
  $2_issuingAuthority?: string;
  /** DLN.3 - Expiration Date */
  $3_end?: string;
}

/** DR DataType */
export interface DR {
  /** DR.1 - Range Start Date/Time */
  $1_start?: string;
  /** DR.2 - Range End Date/Time */
  $2_end?: string;
}

/** DTN DataType */
export interface DTN {
  /** DTN.1 - Day Type */
  $1_dayType?: string;
  /** DTN.2 - Number of Days */
  $2_days?: string;
}

/** EI DataType */
export interface EI {
  /** EI.1 - Entity Identifier */
  $1_value?: string;
  /** EI.2 - Namespace ID */
  $2_namespace?: string;
  /** EI.3 - Universal ID */
  $3_system?: string;
  /** EI.4 - Universal ID Type */
  $4_systemType?: string;
}

/** EIP DataType */
export interface EIP {
  /** EIP.1 - Placer Assigned Identifier */
  $1_placer?: EI;
  /** EIP.2 - Filler Assigned Identifier */
  $2_filler?: EI;
}

/** FC DataType */
export interface FC {
  /** FC.1 - Financial Class Code */
  $1_code?: string;
  /** FC.2 - Effective Date */
  $2_start?: string;
}

/** FN DataType */
export interface FN {
  /** FN.1 - Surname */
  $1_family?: string;
  /** FN.2 - Own Surname Prefix */
  $2_ownPrefix?: string;
  /** FN.3 - Own Surname */
  $3_ownFamily?: string;
  /** FN.4 - Surname Prefix From Partner/Spouse */
  $4_partnerPrefix?: string;
  /** FN.5 - Surname From Partner/Spouse */
  $5_partnerFamily?: string;
}

/** HD DataType */
export interface HD {
  /** HD.1 - Namespace ID */
  $1_namespace?: string;
  /** HD.2 - Universal ID */
  $2_system?: string;
  /** HD.3 - Universal ID Type */
  $3_systemType?: string;
}

/** ICD DataType */
export interface ICD {
  /** ICD.1 - Certification Patient Type */
  $1_patientType?: string;
  /** ICD.2 - Certification Required */
  $2_required?: string;
  /** ICD.3 - Date/Time Certification Required */
  $3_requiredAt?: string;
}

/** JCC DataType */
export interface JCC {
  /** JCC.1 - Job Code */
  $1_jobCode?: string;
  /** JCC.2 - Job Class */
  $2_jobClass?: string;
  /** JCC.3 - Job Description Text */
  $3_jobDescription?: string;
}

/** MO DataType */
export interface MO {
  /** MO.1 - Quantity */
  $1_value?: string;
  /** MO.2 - Denomination */
  $2_currency?: string;
}

/** MOC DataType */
export interface MOC {
  /** MOC.1 - Monetary Amount */
  $1_amount?: MO;
  /** MOC.2 - Charge Code */
  $2_code?: CE;
}

/** MOP DataType */
export interface MOP {
  /** MOP.1 - Money or Percentage Indicator */
  $1_indicator?: string;
  /** MOP.2 - Money or Percentage Quantity */
  $2_value?: string;
  /** MOP.3 - Currency Denomination */
  $3_currency?: string;
}

/** MSG DataType */
export interface MSG {
  /** MSG.1 - Message Code */
  $1_code?: string;
  /** MSG.2 - Trigger Event */
  $2_event?: string;
  /** MSG.3 - Message Structure */
  $3_structure?: string;
}

/** NDL DataType */
export interface NDL {
  /** NDL.1 - Name */
  $1_name?: CNN;
  /** NDL.2 - Start Date/time */
  $2_start?: string;
  /** NDL.3 - End Date/time */
  $3_end?: string;
  /** NDL.4 - Point of Care */
  $4_careSite?: string;
  /** NDL.5 - Room */
  $5_room?: string;
  /** NDL.6 - Bed */
  $6_bed?: string;
  /** NDL.7 - Facility */
  $7_facility?: HD;
  /** NDL.8 - Location Status */
  $8_status?: string;
  /** NDL.9 - Patient Location Type */
  $9_locationType?: string;
  /** NDL.10 - Building */
  $10_building?: string;
  /** NDL.11 - Floor */
  $11_floor?: string;
}

/** OCD DataType */
export interface OCD {
  /** OCD.1 - Occurrence Code */
  $1_code?: CNE;
  /** OCD.2 - Occurrence Date */
  $2_date?: string;
}

/** OSD DataType */
export interface OSD {
  /** OSD.1 - Sequence/Results Flag */
  $1_flag?: string;
  /** OSD.2 - Placer Order Number: Entity Identifier */
  $2_placerId?: string;
  /** OSD.3 - Placer Order Number: Namespace ID */
  $3_placerNamespace?: string;
  /** OSD.4 - Filler Order Number: Entity Identifier */
  $4_fillerId?: string;
  /** OSD.5 - Filler Order Number: Namespace ID */
  $5_fillerNamespace?: string;
  /** OSD.6 - Sequence Condition Value */
  $6_condition?: string;
  /** OSD.7 - Maximum Number of Repeats */
  $7_maxRepeats?: string;
  /** OSD.8 - Placer Order Number: Universal ID */
  $8_placerSystem?: string;
  /** OSD.9 - Placer Order Number: Universal ID Type */
  $9_placerSystemType?: string;
  /** OSD.10 - Filler Order Number: Universal ID */
  $10_fillerSystem?: string;
  /** OSD.11 - Filler Order Number: Universal ID Type */
  $11_fillerSystemType?: string;
}

/** OSP DataType */
export interface OSP {
  /** OSP.1 - Occurrence Span Code */
  $1_code?: CNE;
  /** OSP.2 - Occurrence Span Start Date */
  $2_start?: string;
  /** OSP.3 - Occurrence Span Stop Date */
  $3_end?: string;
}

/** PL DataType */
export interface PL {
  /** PL.1 - Point of Care */
  $1_careSite?: string;
  /** PL.2 - Room */
  $2_room?: string;
  /** PL.3 - Bed */
  $3_bed?: string;
  /** PL.4 - Facility */
  $4_facility?: HD;
  /** PL.5 - Location Status */
  $5_status?: string;
  /** PL.6 - Person Location Type */
  $6_locationType?: string;
  /** PL.7 - Building */
  $7_building?: string;
  /** PL.8 - Floor */
  $8_floor?: string;
  /** PL.9 - Location Description */
  $9_description?: string;
  /** PL.10 - Comprehensive Location Identifier */
  $10_identifier?: EI;
  /** PL.11 - Assigning Authority for Location */
  $11_locationSystem?: HD;
}

/** PLN DataType */
export interface PLN {
  /** PLN.1 - ID Number */
  $1_value?: string;
  /** PLN.2 - Type of ID Number */
  $2_type?: string;
  /** PLN.3 - State/other Qualifying Information */
  $3_stateQualifier?: string;
  /** PLN.4 - Expiration Date */
  $4_end?: string;
}

/** PRL DataType */
export interface PRL {
  /** PRL.1 - Parent Observation Identifier */
  $1_parent?: CE;
  /** PRL.2 - Parent Observation Sub-identifier */
  $2_parentSubId?: string;
  /** PRL.3 - Parent Observation Value Descriptor */
  $3_parentDescriptor?: string;
}

/** PT DataType */
export interface PT {
  /** PT.1 - Processing ID */
  $1_processingId?: string;
  /** PT.2 - Processing Mode */
  $2_processingMode?: string;
}

/** PTA DataType */
export interface PTA {
  /** PTA.1 - Policy Type */
  $1_policyType?: string;
  /** PTA.2 - Amount Class */
  $2_amountClass?: string;
  /** PTA.3 - Money or Percentage Quantity */
  $3_value?: string;
  /** PTA.4 - Money or Percentage */
  $4_basis?: MOP;
}

/** RI DataType */
export interface RI {
  /** RI.1 - Repeat Pattern */
  $1_pattern?: string;
  /** RI.2 - Explicit Time Interval */
  $2_interval?: string;
}

/** RMC DataType */
export interface RMC {
  /** RMC.1 - Room Type */
  $1_roomType?: string;
  /** RMC.2 - Amount Type */
  $2_amountType?: string;
  /** RMC.3 - Coverage Amount */
  $3_coverage?: string;
  /** RMC.4 - Money or Percentage */
  $4_basis?: MOP;
}

/** RPT DataType */
export interface RPT {
  /** RPT.1 - Repeat Pattern Code */
  $1_when?: CWE;
  /** RPT.2 - Calendar Alignment */
  $2_alignment?: string;
  /** RPT.3 - Phase Range Begin Value */
  $3_phaseStart?: string;
  /** RPT.4 - Phase Range End Value */
  $4_phaseEnd?: string;
  /** RPT.5 - Period Quantity */
  $5_period?: string;
  /** RPT.6 - Period Units */
  $6_periodUnit?: string;
  /** RPT.7 - Institution Specified Time */
  $7_timeOfDay?: string;
  /** RPT.8 - Event */
  $8_event?: string;
  /** RPT.9 - Event Offset Quantity */
  $9_offset?: string;
  /** RPT.10 - Event Offset Units */
  $10_offsetUnit?: string;
  /** RPT.11 - General Timing Specification */
  $11_timing?: string;
}

/** SAD DataType */
export interface SAD {
  /** SAD.1 - Street or Mailing Address */
  $1_line?: string;
  /** SAD.2 - Street Name */
  $2_streetName?: string;
  /** SAD.3 - Dwelling Number */
  $3_houseNumber?: string;
}

/** SPS DataType */
export interface SPS {
  /** SPS.1 - Specimen Source Name or Code */
  $1_specimen?: CWE;
  /** SPS.2 - Additives */
  $2_additives?: CWE;
  /** SPS.3 - Specimen Collection Method */
  $3_collectionMethod?: string;
  /** SPS.4 - Body Site */
  $4_bodySite?: CWE;
  /** SPS.5 - Site Modifier */
  $5_siteModifier?: CWE;
  /** SPS.6 - Collection Method Modifier Code */
  $6_collectionModifier?: CWE;
  /** SPS.7 - Specimen Role */
  $7_role?: CWE;
}

/** TQ DataType */
export interface TQ {
  /** TQ.1 - Quantity */
  $1_value?: CQ;
  /** TQ.2 - Interval */
  $2_interval?: RI;
  /** TQ.3 - Duration */
  $3_duration?: string;
  /** TQ.4 - Start Date/Time */
  $4_start?: string;
  /** TQ.5 - End Date/Time */
  $5_end?: string;
  /** TQ.6 - Priority */
  $6_priority?: string;
  /** TQ.7 - Condition */
  $7_condition?: string;
  /** TQ.8 - Text */
  $8_text?: string;
  /** TQ.9 - Conjunction */
  $9_conjunction?: string;
  /** TQ.10 - Order Sequencing */
  $10_sequence?: OSD;
  /** TQ.11 - Occurrence Duration */
  $11_occurrenceDuration?: CE;
  /** TQ.12 - Total Occurrences */
  $12_totalOccurrences?: string;
}

/** UVC DataType */
export interface UVC {
  /** UVC.1 - Value Code */
  $1_code?: CNE;
  /** UVC.2 - Value Amount */
  $2_amount?: MO;
}

/** VID DataType */
export interface VID {
  /** VID.1 - Version ID */
  $1_version?: string;
  /** VID.2 - Internationalization Code */
  $2_locale?: CE;
  /** VID.3 - International Version ID */
  $3_internationalVersion?: CE;
}

/** XAD DataType */
export interface XAD {
  /** XAD.1 - Street Address */
  $1_line1?: SAD;
  /** XAD.2 - Other Designation */
  $2_line2?: string;
  /** XAD.3 - City */
  $3_city?: string;
  /** XAD.4 - State or Province */
  $4_state?: string;
  /** XAD.5 - Zip or Postal Code */
  $5_postalCode?: string;
  /** XAD.6 - Country */
  $6_country?: string;
  /** XAD.7 - Address Type */
  $7_type?: string;
  /** XAD.8 - Other Geographic Designation */
  $8_additionalLocator?: string;
  /** XAD.9 - County/Parish Code */
  $9_district?: string;
  /** XAD.10 - Census Tract */
  $10_censusTract?: string;
  /** XAD.11 - Address Representation Code */
  $11_representation?: string;
  /** XAD.12 - Address Validity Range */
  $12_period?: DR;
  /** XAD.13 - Effective Date */
  $13_start?: string;
  /** XAD.14 - Expiration Date */
  $14_end?: string;
}

/** XCN DataType */
export interface XCN {
  /** XCN.1 - ID Number */
  $1_value?: string;
  /** XCN.2 - Family Name */
  $2_family?: FN;
  /** XCN.3 - Given Name */
  $3_given?: string;
  /** XCN.4 - Second and Further Given Names or Initials Thereof */
  $4_additionalGiven?: string;
  /** XCN.5 - Suffix (e.g., JR or III) */
  $5_suffix?: string;
  /** XCN.6 - Prefix (e.g., DR) */
  $6_prefix?: string;
  /** XCN.7 - Degree (e.g., MD) */
  $7_qualification?: string;
  /** XCN.8 - Source Table */
  $8_sourceTable?: string;
  /** XCN.9 - Assigning Authority */
  $9_system?: HD;
  /** XCN.10 - Name Type Code */
  $10_use?: string;
  /** XCN.11 - Identifier Check Digit */
  $11_checkDigit?: string;
  /** XCN.12 - Check Digit Scheme */
  $12_checkDigitScheme?: string;
  /** XCN.13 - Identifier Type Code */
  $13_type?: string;
  /** XCN.14 - Assigning Facility */
  $14_assigner?: HD;
  /** XCN.15 - Name Representation Code */
  $15_representation?: string;
  /** XCN.16 - Name Context */
  $16_context?: CE;
  /** XCN.17 - Name Validity Range */
  $17_period?: DR;
  /** XCN.18 - Name Assembly Order */
  $18_order?: string;
  /** XCN.19 - Effective Date */
  $19_start?: string;
  /** XCN.20 - Expiration Date */
  $20_end?: string;
  /** XCN.21 - Professional Suffix */
  $21_credential?: string;
  /** XCN.22 - Assigning Jurisdiction */
  $22_jurisdiction?: CWE;
  /** XCN.23 - Assigning Agency or Department */
  $23_department?: CWE;
}

/** XON DataType */
export interface XON {
  /** XON.1 - Organization Name */
  $1_name?: string;
  /** XON.2 - Organization Name Type Code */
  $2_nameType?: string;
  /** XON.3 - ID Number */
  $3_value?: string;
  /** XON.4 - Check Digit */
  $4_checkDigit?: string;
  /** XON.5 - Check Digit Scheme */
  $5_checkDigitScheme?: string;
  /** XON.6 - Assigning Authority */
  $6_system?: HD;
  /** XON.7 - Identifier Type Code */
  $7_type?: string;
  /** XON.8 - Assigning Facility */
  $8_assigner?: HD;
  /** XON.9 - Name Representation Code */
  $9_representation?: string;
  /** XON.10 - Organization Identifier */
  $10_organizationId?: string;
}

/** XPN DataType */
export interface XPN {
  /** XPN.1 - Family Name */
  $1_family?: FN;
  /** XPN.2 - Given Name */
  $2_given?: string;
  /** XPN.3 - Second and Further Given Names or Initials Thereof */
  $3_additionalGiven?: string;
  /** XPN.4 - Suffix (e.g., JR or III) */
  $4_suffix?: string;
  /** XPN.5 - Prefix (e.g., DR) */
  $5_prefix?: string;
  /** XPN.6 - Degree (e.g., MD) */
  $6_qualification?: string;
  /** XPN.7 - Name Type Code */
  $7_use?: string;
  /** XPN.8 - Name Representation Code */
  $8_representation?: string;
  /** XPN.9 - Name Context */
  $9_context?: CE;
  /** XPN.10 - Name Validity Range */
  $10_period?: DR;
  /** XPN.11 - Name Assembly Order */
  $11_order?: string;
  /** XPN.12 - Effective Date */
  $12_start?: string;
  /** XPN.13 - Expiration Date */
  $13_end?: string;
  /** XPN.14 - Professional Suffix */
  $14_credential?: string;
}

/** XTN DataType */
export interface XTN {
  /** XTN.1 - Telephone Number */
  $1_value?: string;
  /** XTN.2 - Telecommunication Use Code */
  $2_use?: string;
  /** XTN.3 - Telecommunication Equipment Type */
  $3_system?: string;
  /** XTN.4 - Email Address */
  $4_email?: string;
  /** XTN.5 - Country Code */
  $5_countryCode?: string;
  /** XTN.6 - Area/City Code */
  $6_areaCode?: string;
  /** XTN.7 - Local Number */
  $7_localNumber?: string;
  /** XTN.8 - Extension */
  $8_extension?: string;
  /** XTN.9 - Any Text */
  $9_text?: string;
  /** XTN.10 - Extension Prefix */
  $10_extensionPrefix?: string;
  /** XTN.11 - Speed Dial Code */
  $11_speedDial?: string;
  /** XTN.12 - Unformatted Telephone number */
  $12_unformatted?: string;
}

// ====== Conversion Functions ======

/** Convert a record object to FieldValue */
function toFieldValue(obj: Record<string, unknown> | null | undefined): FieldValue | undefined {
  if (obj == null) return undefined;
  const result: { [key: number]: FieldValue } = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value == null) continue;
    const match = key.match(/^\$(\d+)_/);
    if (!match || !match[1]) continue;
    const idx = parseInt(match[1], 10);
    if (typeof value === "string") {
      result[idx] = value;
    } else if (typeof value === "object") {
      const nested = toFieldValue(value as Record<string, unknown>);
      if (nested !== undefined) result[idx] = nested;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

// ====== FromFieldValue Converters ======

/** Convert FieldValue to AUI */
function fromAUI(fv: FieldValue | undefined): AUI | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_authorization: fv };
  if (Array.isArray(fv)) return fromAUI(fv[0]);
  const result: AUI = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_authorization = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_authorization = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_date = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_date = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_source = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_source = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to CE */
function fromCE(fv: FieldValue | undefined): CE | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fv };
  if (Array.isArray(fv)) return fromCE(fv[0]);
  const result: CE = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_code = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_code = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_text = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_text = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_system = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_system = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_altCode = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_altCode = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_altDisplay = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_altDisplay = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_altSystem = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_altSystem = (v6 as any)[1];
  }
  return result;
}

/** Convert FieldValue to CNE */
function fromCNE(fv: FieldValue | undefined): CNE | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fv };
  if (Array.isArray(fv)) return fromCNE(fv[0]);
  const result: CNE = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_code = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_code = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_text = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_text = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_system = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_system = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_altCode = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_altCode = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_altDisplay = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_altDisplay = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_altSystem = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_altSystem = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_version = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_version = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_altVersion = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_altVersion = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_originalText = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_originalText = (v9 as any)[1];
  }
  return result;
}

/** Convert FieldValue to CNN */
function fromCNN(fv: FieldValue | undefined): CNN | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fv };
  if (Array.isArray(fv)) return fromCNN(fv[0]);
  const result: CNN = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_value = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_value = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_family = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_family = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_given = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_given = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_additionalGiven = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_additionalGiven = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_suffix = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_suffix = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_prefix = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_prefix = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_qualification = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_qualification = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_sourceTable = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_sourceTable = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_systemNamespace = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_systemNamespace = (v9 as any)[1];
  }
  if (fv[10] !== undefined) {
    const v10 = fv[10];
    if (typeof v10 === "string") result.$10_systemId = v10;
    else if (typeof v10 === "object" && !Array.isArray(v10) && typeof (v10 as any)[1] === "string") result.$10_systemId = (v10 as any)[1];
  }
  if (fv[11] !== undefined) {
    const v11 = fv[11];
    if (typeof v11 === "string") result.$11_systemType = v11;
    else if (typeof v11 === "object" && !Array.isArray(v11) && typeof (v11 as any)[1] === "string") result.$11_systemType = (v11 as any)[1];
  }
  return result;
}

/** Convert FieldValue to CP */
function fromCP(fv: FieldValue | undefined): CP | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_amount: fromMO(fv) };
  if (Array.isArray(fv)) return fromCP(fv[0]);
  const result: CP = {};
  if (fv[1] !== undefined) result.$1_amount = fromMO(fv[1]);
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_priceType = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_priceType = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_low = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_low = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_high = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_high = (v4 as any)[1];
  }
  if (fv[5] !== undefined) result.$5_unit = fromCE(fv[5]);
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_rangeType = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_rangeType = (v6 as any)[1];
  }
  return result;
}

/** Convert FieldValue to CQ */
function fromCQ(fv: FieldValue | undefined): CQ | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fv };
  if (Array.isArray(fv)) return fromCQ(fv[0]);
  const result: CQ = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_value = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_value = (v1 as any)[1];
  }
  if (fv[2] !== undefined) result.$2_unit = fromCE(fv[2]);
  return result;
}

/** Convert FieldValue to CWE */
function fromCWE(fv: FieldValue | undefined): CWE | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fv };
  if (Array.isArray(fv)) return fromCWE(fv[0]);
  const result: CWE = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_code = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_code = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_text = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_text = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_system = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_system = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_altCode = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_altCode = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_altDisplay = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_altDisplay = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_altSystem = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_altSystem = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_version = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_version = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_altVersion = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_altVersion = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_originalText = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_originalText = (v9 as any)[1];
  }
  return result;
}

/** Convert FieldValue to CX */
function fromCX(fv: FieldValue | undefined): CX | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fv };
  if (Array.isArray(fv)) return fromCX(fv[0]);
  const result: CX = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_value = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_value = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_checkDigit = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_checkDigit = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_checkDigitScheme = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_checkDigitScheme = (v3 as any)[1];
  }
  if (fv[4] !== undefined) result.$4_system = fromHD(fv[4]);
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_type = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_type = (v5 as any)[1];
  }
  if (fv[6] !== undefined) result.$6_assigner = fromHD(fv[6]);
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_start = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_start = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_end = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_end = (v8 as any)[1];
  }
  if (fv[9] !== undefined) result.$9_jurisdiction = fromCWE(fv[9]);
  if (fv[10] !== undefined) result.$10_department = fromCWE(fv[10]);
  return result;
}

/** Convert FieldValue to DDI */
function fromDDI(fv: FieldValue | undefined): DDI | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_delay: fv };
  if (Array.isArray(fv)) return fromDDI(fv[0]);
  const result: DDI = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_delay = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_delay = (v1 as any)[1];
  }
  if (fv[2] !== undefined) result.$2_amount = fromMO(fv[2]);
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_days = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_days = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to DLD */
function fromDLD(fv: FieldValue | undefined): DLD | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_location: fv };
  if (Array.isArray(fv)) return fromDLD(fv[0]);
  const result: DLD = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_location = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_location = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_start = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_start = (v2 as any)[1];
  }
  return result;
}

/** Convert FieldValue to DLN */
function fromDLN(fv: FieldValue | undefined): DLN | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_license: fv };
  if (Array.isArray(fv)) return fromDLN(fv[0]);
  const result: DLN = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_license = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_license = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_issuingAuthority = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_issuingAuthority = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_end = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_end = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to DR */
function fromDR(fv: FieldValue | undefined): DR | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_start: fv };
  if (Array.isArray(fv)) return fromDR(fv[0]);
  const result: DR = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_start = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_start = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_end = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_end = (v2 as any)[1];
  }
  return result;
}

/** Convert FieldValue to DTN */
function fromDTN(fv: FieldValue | undefined): DTN | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_dayType: fv };
  if (Array.isArray(fv)) return fromDTN(fv[0]);
  const result: DTN = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_dayType = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_dayType = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_days = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_days = (v2 as any)[1];
  }
  return result;
}

/** Convert FieldValue to EI */
function fromEI(fv: FieldValue | undefined): EI | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fv };
  if (Array.isArray(fv)) return fromEI(fv[0]);
  const result: EI = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_value = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_value = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_namespace = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_namespace = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_system = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_system = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_systemType = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_systemType = (v4 as any)[1];
  }
  return result;
}

/** Convert FieldValue to EIP */
function fromEIP(fv: FieldValue | undefined): EIP | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_placer: fromEI(fv) };
  if (Array.isArray(fv)) return fromEIP(fv[0]);
  const result: EIP = {};
  if (fv[1] !== undefined) result.$1_placer = fromEI(fv[1]);
  if (fv[2] !== undefined) result.$2_filler = fromEI(fv[2]);
  return result;
}

/** Convert FieldValue to FC */
function fromFC(fv: FieldValue | undefined): FC | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fv };
  if (Array.isArray(fv)) return fromFC(fv[0]);
  const result: FC = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_code = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_code = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_start = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_start = (v2 as any)[1];
  }
  return result;
}

/** Convert FieldValue to FN */
function fromFN(fv: FieldValue | undefined): FN | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_family: fv };
  if (Array.isArray(fv)) return fromFN(fv[0]);
  const result: FN = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_family = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_family = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_ownPrefix = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_ownPrefix = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_ownFamily = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_ownFamily = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_partnerPrefix = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_partnerPrefix = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_partnerFamily = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_partnerFamily = (v5 as any)[1];
  }
  return result;
}

/** Convert FieldValue to HD */
function fromHD(fv: FieldValue | undefined): HD | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_namespace: fv };
  if (Array.isArray(fv)) return fromHD(fv[0]);
  const result: HD = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_namespace = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_namespace = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_system = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_system = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_systemType = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_systemType = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to ICD */
function fromICD(fv: FieldValue | undefined): ICD | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_patientType: fv };
  if (Array.isArray(fv)) return fromICD(fv[0]);
  const result: ICD = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_patientType = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_patientType = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_required = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_required = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_requiredAt = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_requiredAt = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to JCC */
function fromJCC(fv: FieldValue | undefined): JCC | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_jobCode: fv };
  if (Array.isArray(fv)) return fromJCC(fv[0]);
  const result: JCC = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_jobCode = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_jobCode = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_jobClass = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_jobClass = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_jobDescription = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_jobDescription = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to MO */
function fromMO(fv: FieldValue | undefined): MO | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fv };
  if (Array.isArray(fv)) return fromMO(fv[0]);
  const result: MO = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_value = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_value = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_currency = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_currency = (v2 as any)[1];
  }
  return result;
}

/** Convert FieldValue to MOC */
function fromMOC(fv: FieldValue | undefined): MOC | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_amount: fromMO(fv) };
  if (Array.isArray(fv)) return fromMOC(fv[0]);
  const result: MOC = {};
  if (fv[1] !== undefined) result.$1_amount = fromMO(fv[1]);
  if (fv[2] !== undefined) result.$2_code = fromCE(fv[2]);
  return result;
}

/** Convert FieldValue to MOP */
function fromMOP(fv: FieldValue | undefined): MOP | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_indicator: fv };
  if (Array.isArray(fv)) return fromMOP(fv[0]);
  const result: MOP = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_indicator = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_indicator = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_value = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_value = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_currency = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_currency = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to MSG */
function fromMSG(fv: FieldValue | undefined): MSG | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fv };
  if (Array.isArray(fv)) return fromMSG(fv[0]);
  const result: MSG = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_code = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_code = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_event = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_event = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_structure = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_structure = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to NDL */
function fromNDL(fv: FieldValue | undefined): NDL | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_name: fromCNN(fv) };
  if (Array.isArray(fv)) return fromNDL(fv[0]);
  const result: NDL = {};
  if (fv[1] !== undefined) result.$1_name = fromCNN(fv[1]);
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_start = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_start = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_end = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_end = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_careSite = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_careSite = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_room = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_room = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_bed = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_bed = (v6 as any)[1];
  }
  if (fv[7] !== undefined) result.$7_facility = fromHD(fv[7]);
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_status = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_status = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_locationType = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_locationType = (v9 as any)[1];
  }
  if (fv[10] !== undefined) {
    const v10 = fv[10];
    if (typeof v10 === "string") result.$10_building = v10;
    else if (typeof v10 === "object" && !Array.isArray(v10) && typeof (v10 as any)[1] === "string") result.$10_building = (v10 as any)[1];
  }
  if (fv[11] !== undefined) {
    const v11 = fv[11];
    if (typeof v11 === "string") result.$11_floor = v11;
    else if (typeof v11 === "object" && !Array.isArray(v11) && typeof (v11 as any)[1] === "string") result.$11_floor = (v11 as any)[1];
  }
  return result;
}

/** Convert FieldValue to OCD */
function fromOCD(fv: FieldValue | undefined): OCD | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fromCNE(fv) };
  if (Array.isArray(fv)) return fromOCD(fv[0]);
  const result: OCD = {};
  if (fv[1] !== undefined) result.$1_code = fromCNE(fv[1]);
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_date = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_date = (v2 as any)[1];
  }
  return result;
}

/** Convert FieldValue to OSD */
function fromOSD(fv: FieldValue | undefined): OSD | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_flag: fv };
  if (Array.isArray(fv)) return fromOSD(fv[0]);
  const result: OSD = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_flag = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_flag = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_placerId = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_placerId = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_placerNamespace = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_placerNamespace = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_fillerId = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_fillerId = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_fillerNamespace = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_fillerNamespace = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_condition = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_condition = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_maxRepeats = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_maxRepeats = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_placerSystem = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_placerSystem = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_placerSystemType = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_placerSystemType = (v9 as any)[1];
  }
  if (fv[10] !== undefined) {
    const v10 = fv[10];
    if (typeof v10 === "string") result.$10_fillerSystem = v10;
    else if (typeof v10 === "object" && !Array.isArray(v10) && typeof (v10 as any)[1] === "string") result.$10_fillerSystem = (v10 as any)[1];
  }
  if (fv[11] !== undefined) {
    const v11 = fv[11];
    if (typeof v11 === "string") result.$11_fillerSystemType = v11;
    else if (typeof v11 === "object" && !Array.isArray(v11) && typeof (v11 as any)[1] === "string") result.$11_fillerSystemType = (v11 as any)[1];
  }
  return result;
}

/** Convert FieldValue to OSP */
function fromOSP(fv: FieldValue | undefined): OSP | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fromCNE(fv) };
  if (Array.isArray(fv)) return fromOSP(fv[0]);
  const result: OSP = {};
  if (fv[1] !== undefined) result.$1_code = fromCNE(fv[1]);
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_start = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_start = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_end = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_end = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to PL */
function fromPL(fv: FieldValue | undefined): PL | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_careSite: fv };
  if (Array.isArray(fv)) return fromPL(fv[0]);
  const result: PL = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_careSite = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_careSite = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_room = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_room = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_bed = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_bed = (v3 as any)[1];
  }
  if (fv[4] !== undefined) result.$4_facility = fromHD(fv[4]);
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_status = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_status = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_locationType = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_locationType = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_building = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_building = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_floor = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_floor = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_description = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_description = (v9 as any)[1];
  }
  if (fv[10] !== undefined) result.$10_identifier = fromEI(fv[10]);
  if (fv[11] !== undefined) result.$11_locationSystem = fromHD(fv[11]);
  return result;
}

/** Convert FieldValue to PLN */
function fromPLN(fv: FieldValue | undefined): PLN | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fv };
  if (Array.isArray(fv)) return fromPLN(fv[0]);
  const result: PLN = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_value = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_value = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_type = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_type = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_stateQualifier = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_stateQualifier = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_end = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_end = (v4 as any)[1];
  }
  return result;
}

/** Convert FieldValue to PRL */
function fromPRL(fv: FieldValue | undefined): PRL | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_parent: fromCE(fv) };
  if (Array.isArray(fv)) return fromPRL(fv[0]);
  const result: PRL = {};
  if (fv[1] !== undefined) result.$1_parent = fromCE(fv[1]);
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_parentSubId = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_parentSubId = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_parentDescriptor = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_parentDescriptor = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to PT */
function fromPT(fv: FieldValue | undefined): PT | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_processingId: fv };
  if (Array.isArray(fv)) return fromPT(fv[0]);
  const result: PT = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_processingId = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_processingId = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_processingMode = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_processingMode = (v2 as any)[1];
  }
  return result;
}

/** Convert FieldValue to PTA */
function fromPTA(fv: FieldValue | undefined): PTA | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_policyType: fv };
  if (Array.isArray(fv)) return fromPTA(fv[0]);
  const result: PTA = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_policyType = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_policyType = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_amountClass = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_amountClass = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_value = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_value = (v3 as any)[1];
  }
  if (fv[4] !== undefined) result.$4_basis = fromMOP(fv[4]);
  return result;
}

/** Convert FieldValue to RI */
function fromRI(fv: FieldValue | undefined): RI | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_pattern: fv };
  if (Array.isArray(fv)) return fromRI(fv[0]);
  const result: RI = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_pattern = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_pattern = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_interval = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_interval = (v2 as any)[1];
  }
  return result;
}

/** Convert FieldValue to RMC */
function fromRMC(fv: FieldValue | undefined): RMC | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_roomType: fv };
  if (Array.isArray(fv)) return fromRMC(fv[0]);
  const result: RMC = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_roomType = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_roomType = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_amountType = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_amountType = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_coverage = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_coverage = (v3 as any)[1];
  }
  if (fv[4] !== undefined) result.$4_basis = fromMOP(fv[4]);
  return result;
}

/** Convert FieldValue to RPT */
function fromRPT(fv: FieldValue | undefined): RPT | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_when: fromCWE(fv) };
  if (Array.isArray(fv)) return fromRPT(fv[0]);
  const result: RPT = {};
  if (fv[1] !== undefined) result.$1_when = fromCWE(fv[1]);
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_alignment = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_alignment = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_phaseStart = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_phaseStart = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_phaseEnd = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_phaseEnd = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_period = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_period = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_periodUnit = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_periodUnit = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_timeOfDay = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_timeOfDay = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_event = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_event = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_offset = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_offset = (v9 as any)[1];
  }
  if (fv[10] !== undefined) {
    const v10 = fv[10];
    if (typeof v10 === "string") result.$10_offsetUnit = v10;
    else if (typeof v10 === "object" && !Array.isArray(v10) && typeof (v10 as any)[1] === "string") result.$10_offsetUnit = (v10 as any)[1];
  }
  if (fv[11] !== undefined) {
    const v11 = fv[11];
    if (typeof v11 === "string") result.$11_timing = v11;
    else if (typeof v11 === "object" && !Array.isArray(v11) && typeof (v11 as any)[1] === "string") result.$11_timing = (v11 as any)[1];
  }
  return result;
}

/** Convert FieldValue to SAD */
function fromSAD(fv: FieldValue | undefined): SAD | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_line: fv };
  if (Array.isArray(fv)) return fromSAD(fv[0]);
  const result: SAD = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_line = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_line = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_streetName = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_streetName = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_houseNumber = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_houseNumber = (v3 as any)[1];
  }
  return result;
}

/** Convert FieldValue to SPS */
function fromSPS(fv: FieldValue | undefined): SPS | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_specimen: fromCWE(fv) };
  if (Array.isArray(fv)) return fromSPS(fv[0]);
  const result: SPS = {};
  if (fv[1] !== undefined) result.$1_specimen = fromCWE(fv[1]);
  if (fv[2] !== undefined) result.$2_additives = fromCWE(fv[2]);
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_collectionMethod = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_collectionMethod = (v3 as any)[1];
  }
  if (fv[4] !== undefined) result.$4_bodySite = fromCWE(fv[4]);
  if (fv[5] !== undefined) result.$5_siteModifier = fromCWE(fv[5]);
  if (fv[6] !== undefined) result.$6_collectionModifier = fromCWE(fv[6]);
  if (fv[7] !== undefined) result.$7_role = fromCWE(fv[7]);
  return result;
}

/** Convert FieldValue to TQ */
function fromTQ(fv: FieldValue | undefined): TQ | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fromCQ(fv) };
  if (Array.isArray(fv)) return fromTQ(fv[0]);
  const result: TQ = {};
  if (fv[1] !== undefined) result.$1_value = fromCQ(fv[1]);
  if (fv[2] !== undefined) result.$2_interval = fromRI(fv[2]);
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_duration = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_duration = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_start = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_start = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_end = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_end = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_priority = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_priority = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_condition = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_condition = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_text = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_text = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_conjunction = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_conjunction = (v9 as any)[1];
  }
  if (fv[10] !== undefined) result.$10_sequence = fromOSD(fv[10]);
  if (fv[11] !== undefined) result.$11_occurrenceDuration = fromCE(fv[11]);
  if (fv[12] !== undefined) {
    const v12 = fv[12];
    if (typeof v12 === "string") result.$12_totalOccurrences = v12;
    else if (typeof v12 === "object" && !Array.isArray(v12) && typeof (v12 as any)[1] === "string") result.$12_totalOccurrences = (v12 as any)[1];
  }
  return result;
}

/** Convert FieldValue to UVC */
function fromUVC(fv: FieldValue | undefined): UVC | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_code: fromCNE(fv) };
  if (Array.isArray(fv)) return fromUVC(fv[0]);
  const result: UVC = {};
  if (fv[1] !== undefined) result.$1_code = fromCNE(fv[1]);
  if (fv[2] !== undefined) result.$2_amount = fromMO(fv[2]);
  return result;
}

/** Convert FieldValue to VID */
function fromVID(fv: FieldValue | undefined): VID | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_version: fv };
  if (Array.isArray(fv)) return fromVID(fv[0]);
  const result: VID = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_version = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_version = (v1 as any)[1];
  }
  if (fv[2] !== undefined) result.$2_locale = fromCE(fv[2]);
  if (fv[3] !== undefined) result.$3_internationalVersion = fromCE(fv[3]);
  return result;
}

/** Convert FieldValue to XAD */
function fromXAD(fv: FieldValue | undefined): XAD | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_line1: fromSAD(fv) };
  if (Array.isArray(fv)) return fromXAD(fv[0]);
  const result: XAD = {};
  if (fv[1] !== undefined) result.$1_line1 = fromSAD(fv[1]);
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_line2 = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_line2 = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_city = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_city = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_state = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_state = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_postalCode = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_postalCode = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_country = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_country = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_type = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_type = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_additionalLocator = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_additionalLocator = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_district = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_district = (v9 as any)[1];
  }
  if (fv[10] !== undefined) {
    const v10 = fv[10];
    if (typeof v10 === "string") result.$10_censusTract = v10;
    else if (typeof v10 === "object" && !Array.isArray(v10) && typeof (v10 as any)[1] === "string") result.$10_censusTract = (v10 as any)[1];
  }
  if (fv[11] !== undefined) {
    const v11 = fv[11];
    if (typeof v11 === "string") result.$11_representation = v11;
    else if (typeof v11 === "object" && !Array.isArray(v11) && typeof (v11 as any)[1] === "string") result.$11_representation = (v11 as any)[1];
  }
  if (fv[12] !== undefined) result.$12_period = fromDR(fv[12]);
  if (fv[13] !== undefined) {
    const v13 = fv[13];
    if (typeof v13 === "string") result.$13_start = v13;
    else if (typeof v13 === "object" && !Array.isArray(v13) && typeof (v13 as any)[1] === "string") result.$13_start = (v13 as any)[1];
  }
  if (fv[14] !== undefined) {
    const v14 = fv[14];
    if (typeof v14 === "string") result.$14_end = v14;
    else if (typeof v14 === "object" && !Array.isArray(v14) && typeof (v14 as any)[1] === "string") result.$14_end = (v14 as any)[1];
  }
  return result;
}

/** Convert FieldValue to XCN */
function fromXCN(fv: FieldValue | undefined): XCN | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fv };
  if (Array.isArray(fv)) return fromXCN(fv[0]);
  const result: XCN = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_value = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_value = (v1 as any)[1];
  }
  if (fv[2] !== undefined) result.$2_family = fromFN(fv[2]);
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_given = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_given = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_additionalGiven = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_additionalGiven = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_suffix = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_suffix = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_prefix = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_prefix = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_qualification = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_qualification = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_sourceTable = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_sourceTable = (v8 as any)[1];
  }
  if (fv[9] !== undefined) result.$9_system = fromHD(fv[9]);
  if (fv[10] !== undefined) {
    const v10 = fv[10];
    if (typeof v10 === "string") result.$10_use = v10;
    else if (typeof v10 === "object" && !Array.isArray(v10) && typeof (v10 as any)[1] === "string") result.$10_use = (v10 as any)[1];
  }
  if (fv[11] !== undefined) {
    const v11 = fv[11];
    if (typeof v11 === "string") result.$11_checkDigit = v11;
    else if (typeof v11 === "object" && !Array.isArray(v11) && typeof (v11 as any)[1] === "string") result.$11_checkDigit = (v11 as any)[1];
  }
  if (fv[12] !== undefined) {
    const v12 = fv[12];
    if (typeof v12 === "string") result.$12_checkDigitScheme = v12;
    else if (typeof v12 === "object" && !Array.isArray(v12) && typeof (v12 as any)[1] === "string") result.$12_checkDigitScheme = (v12 as any)[1];
  }
  if (fv[13] !== undefined) {
    const v13 = fv[13];
    if (typeof v13 === "string") result.$13_type = v13;
    else if (typeof v13 === "object" && !Array.isArray(v13) && typeof (v13 as any)[1] === "string") result.$13_type = (v13 as any)[1];
  }
  if (fv[14] !== undefined) result.$14_assigner = fromHD(fv[14]);
  if (fv[15] !== undefined) {
    const v15 = fv[15];
    if (typeof v15 === "string") result.$15_representation = v15;
    else if (typeof v15 === "object" && !Array.isArray(v15) && typeof (v15 as any)[1] === "string") result.$15_representation = (v15 as any)[1];
  }
  if (fv[16] !== undefined) result.$16_context = fromCE(fv[16]);
  if (fv[17] !== undefined) result.$17_period = fromDR(fv[17]);
  if (fv[18] !== undefined) {
    const v18 = fv[18];
    if (typeof v18 === "string") result.$18_order = v18;
    else if (typeof v18 === "object" && !Array.isArray(v18) && typeof (v18 as any)[1] === "string") result.$18_order = (v18 as any)[1];
  }
  if (fv[19] !== undefined) {
    const v19 = fv[19];
    if (typeof v19 === "string") result.$19_start = v19;
    else if (typeof v19 === "object" && !Array.isArray(v19) && typeof (v19 as any)[1] === "string") result.$19_start = (v19 as any)[1];
  }
  if (fv[20] !== undefined) {
    const v20 = fv[20];
    if (typeof v20 === "string") result.$20_end = v20;
    else if (typeof v20 === "object" && !Array.isArray(v20) && typeof (v20 as any)[1] === "string") result.$20_end = (v20 as any)[1];
  }
  if (fv[21] !== undefined) {
    const v21 = fv[21];
    if (typeof v21 === "string") result.$21_credential = v21;
    else if (typeof v21 === "object" && !Array.isArray(v21) && typeof (v21 as any)[1] === "string") result.$21_credential = (v21 as any)[1];
  }
  if (fv[22] !== undefined) result.$22_jurisdiction = fromCWE(fv[22]);
  if (fv[23] !== undefined) result.$23_department = fromCWE(fv[23]);
  return result;
}

/** Convert FieldValue to XON */
function fromXON(fv: FieldValue | undefined): XON | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_name: fv };
  if (Array.isArray(fv)) return fromXON(fv[0]);
  const result: XON = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_name = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_name = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_nameType = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_nameType = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_value = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_value = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_checkDigit = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_checkDigit = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_checkDigitScheme = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_checkDigitScheme = (v5 as any)[1];
  }
  if (fv[6] !== undefined) result.$6_system = fromHD(fv[6]);
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_type = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_type = (v7 as any)[1];
  }
  if (fv[8] !== undefined) result.$8_assigner = fromHD(fv[8]);
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_representation = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_representation = (v9 as any)[1];
  }
  if (fv[10] !== undefined) {
    const v10 = fv[10];
    if (typeof v10 === "string") result.$10_organizationId = v10;
    else if (typeof v10 === "object" && !Array.isArray(v10) && typeof (v10 as any)[1] === "string") result.$10_organizationId = (v10 as any)[1];
  }
  return result;
}

/** Convert FieldValue to XPN */
function fromXPN(fv: FieldValue | undefined): XPN | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_family: fromFN(fv) };
  if (Array.isArray(fv)) return fromXPN(fv[0]);
  const result: XPN = {};
  if (fv[1] !== undefined) result.$1_family = fromFN(fv[1]);
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_given = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_given = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_additionalGiven = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_additionalGiven = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_suffix = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_suffix = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_prefix = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_prefix = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_qualification = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_qualification = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_use = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_use = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_representation = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_representation = (v8 as any)[1];
  }
  if (fv[9] !== undefined) result.$9_context = fromCE(fv[9]);
  if (fv[10] !== undefined) result.$10_period = fromDR(fv[10]);
  if (fv[11] !== undefined) {
    const v11 = fv[11];
    if (typeof v11 === "string") result.$11_order = v11;
    else if (typeof v11 === "object" && !Array.isArray(v11) && typeof (v11 as any)[1] === "string") result.$11_order = (v11 as any)[1];
  }
  if (fv[12] !== undefined) {
    const v12 = fv[12];
    if (typeof v12 === "string") result.$12_start = v12;
    else if (typeof v12 === "object" && !Array.isArray(v12) && typeof (v12 as any)[1] === "string") result.$12_start = (v12 as any)[1];
  }
  if (fv[13] !== undefined) {
    const v13 = fv[13];
    if (typeof v13 === "string") result.$13_end = v13;
    else if (typeof v13 === "object" && !Array.isArray(v13) && typeof (v13 as any)[1] === "string") result.$13_end = (v13 as any)[1];
  }
  if (fv[14] !== undefined) {
    const v14 = fv[14];
    if (typeof v14 === "string") result.$14_credential = v14;
    else if (typeof v14 === "object" && !Array.isArray(v14) && typeof (v14 as any)[1] === "string") result.$14_credential = (v14 as any)[1];
  }
  return result;
}

/** Convert FieldValue to XTN */
function fromXTN(fv: FieldValue | undefined): XTN | undefined {
  if (fv === undefined) return undefined;
  if (typeof fv === "string") return { $1_value: fv };
  if (Array.isArray(fv)) return fromXTN(fv[0]);
  const result: XTN = {};
  if (fv[1] !== undefined) {
    const v1 = fv[1];
    if (typeof v1 === "string") result.$1_value = v1;
    else if (typeof v1 === "object" && !Array.isArray(v1) && typeof (v1 as any)[1] === "string") result.$1_value = (v1 as any)[1];
  }
  if (fv[2] !== undefined) {
    const v2 = fv[2];
    if (typeof v2 === "string") result.$2_use = v2;
    else if (typeof v2 === "object" && !Array.isArray(v2) && typeof (v2 as any)[1] === "string") result.$2_use = (v2 as any)[1];
  }
  if (fv[3] !== undefined) {
    const v3 = fv[3];
    if (typeof v3 === "string") result.$3_system = v3;
    else if (typeof v3 === "object" && !Array.isArray(v3) && typeof (v3 as any)[1] === "string") result.$3_system = (v3 as any)[1];
  }
  if (fv[4] !== undefined) {
    const v4 = fv[4];
    if (typeof v4 === "string") result.$4_email = v4;
    else if (typeof v4 === "object" && !Array.isArray(v4) && typeof (v4 as any)[1] === "string") result.$4_email = (v4 as any)[1];
  }
  if (fv[5] !== undefined) {
    const v5 = fv[5];
    if (typeof v5 === "string") result.$5_countryCode = v5;
    else if (typeof v5 === "object" && !Array.isArray(v5) && typeof (v5 as any)[1] === "string") result.$5_countryCode = (v5 as any)[1];
  }
  if (fv[6] !== undefined) {
    const v6 = fv[6];
    if (typeof v6 === "string") result.$6_areaCode = v6;
    else if (typeof v6 === "object" && !Array.isArray(v6) && typeof (v6 as any)[1] === "string") result.$6_areaCode = (v6 as any)[1];
  }
  if (fv[7] !== undefined) {
    const v7 = fv[7];
    if (typeof v7 === "string") result.$7_localNumber = v7;
    else if (typeof v7 === "object" && !Array.isArray(v7) && typeof (v7 as any)[1] === "string") result.$7_localNumber = (v7 as any)[1];
  }
  if (fv[8] !== undefined) {
    const v8 = fv[8];
    if (typeof v8 === "string") result.$8_extension = v8;
    else if (typeof v8 === "object" && !Array.isArray(v8) && typeof (v8 as any)[1] === "string") result.$8_extension = (v8 as any)[1];
  }
  if (fv[9] !== undefined) {
    const v9 = fv[9];
    if (typeof v9 === "string") result.$9_text = v9;
    else if (typeof v9 === "object" && !Array.isArray(v9) && typeof (v9 as any)[1] === "string") result.$9_text = (v9 as any)[1];
  }
  if (fv[10] !== undefined) {
    const v10 = fv[10];
    if (typeof v10 === "string") result.$10_extensionPrefix = v10;
    else if (typeof v10 === "object" && !Array.isArray(v10) && typeof (v10 as any)[1] === "string") result.$10_extensionPrefix = (v10 as any)[1];
  }
  if (fv[11] !== undefined) {
    const v11 = fv[11];
    if (typeof v11 === "string") result.$11_speedDial = v11;
    else if (typeof v11 === "object" && !Array.isArray(v11) && typeof (v11 as any)[1] === "string") result.$11_speedDial = (v11 as any)[1];
  }
  if (fv[12] !== undefined) {
    const v12 = fv[12];
    if (typeof v12 === "string") result.$12_unformatted = v12;
    else if (typeof v12 === "object" && !Array.isArray(v12) && typeof (v12 as any)[1] === "string") result.$12_unformatted = (v12 as any)[1];
  }
  return result;
}

// ====== Segment Interfaces ======

/** ACC Segment */
export interface ACC {
  /** ACC.1 - Accident Date/Time */
  $1_accidentDateTime?: string;
  /** ACC.2 - Accident Code */
  $2_accidentCode?: CE;
  /** ACC.3 - Accident Location */
  $3_accidentLocation?: string;
  /** ACC.4 - Auto Accident State */
  $4_autoAccidentState?: CE;
  /** ACC.5 - Accident Job Related Indicator */
  $5_accidentJobRelatedIndicator?: string;
  /** ACC.6 - Accident Death Indicator */
  $6_accidentDeathIndicator?: string;
  /** ACC.7 - Entered By */
  $7_enteredBy?: XCN;
  /** ACC.8 - Accident Description */
  $8_accidentDescription?: string;
  /** ACC.9 - Brought In By */
  $9_broughtInBy?: string;
  /** ACC.10 - Police Notified Indicator */
  $10_policeNotifiedIndicator?: string;
  /** ACC.11 - Accident Address */
  $11_accidentAddress?: XAD;
}

/** AL1 Segment */
export interface AL1 {
  /** AL1.1 - Set ID - AL1 */
  $1_setIdAl1: string;
  /** AL1.2 - Allergen Type Code */
  $2_allergenTypeCode?: CE;
  /** AL1.3 - Allergen Code/Mnemonic/Description */
  $3_allergenCodeMnemonicDescription: CE;
  /** AL1.4 - Allergy Severity Code */
  $4_allergySeverityCode?: CE;
  /** AL1.5 - Allergy Reaction Code */
  $5_allergyReactionCode?: string[];
  /** AL1.6 - Identification Date */
  $6_identificationDate?: string;
}

/** CTD Segment */
export interface CTD {
  /** CTD.1 - Contact Role */
  $1_contactRole: CE[];
  /** CTD.2 - Contact Name */
  $2_contactName?: XPN[];
  /** CTD.3 - Contact Address */
  $3_contactAddress?: XAD[];
  /** CTD.4 - Contact Location */
  $4_contactLocation?: PL;
  /** CTD.5 - Contact Communication Information */
  $5_contactCommunicationInformation?: XTN[];
  /** CTD.6 - Preferred Method of Contact */
  $6_contactPreference?: CE;
  /** CTD.7 - Contact Identifiers */
  $7_contactIdentifiers?: PLN[];
}

/** CTI Segment */
export interface CTI {
  /** CTI.1 - Sponsor Study ID */
  $1_studyId: EI;
  /** CTI.2 - Study Phase Identifier */
  $2_studyPhaseId?: CE;
  /** CTI.3 - Study Scheduled Time Point */
  $3_studyScheduledTimePoint?: CE;
}

/** DB1 Segment */
export interface DB1 {
  /** DB1.1 - Set ID - DB1 */
  $1_setIdDb1: string;
  /** DB1.2 - Disabled Person Code */
  $2_disabledPersonCode?: DisabilityInformationRelationship | string;
  /** DB1.3 - Disabled Person Identifier */
  $3_disabledPersonIdentifier?: CX[];
  /** DB1.4 - Disabled Indicator */
  $4_disabledIndicator?: string;
  /** DB1.5 - Disability Start Date */
  $5_disabilityStartDate?: string;
  /** DB1.6 - Disability End Date */
  $6_disabilityEndDate?: string;
  /** DB1.7 - Disability Return to Work Date */
  $7_disabilityReturnToWorkDate?: string;
  /** DB1.8 - Disability Unable to Work Date */
  $8_disabilityUnableToWorkDate?: string;
}

/** DG1 Segment */
export interface DG1 {
  /** DG1.1 - Set ID - DG1 */
  $1_setIdDg1: string;
  /** DG1.2 - Diagnosis Coding Method */
  $2_diagnosisCodingMethod?: string;
  /** DG1.3 - Diagnosis Code - DG1 */
  $3_diagnosisCodeDg1?: CE;
  /** DG1.4 - Diagnosis Description */
  $4_diagnosisDescription?: string;
  /** DG1.5 - Diagnosis Date/Time */
  $5_diagnosisDateTime?: string;
  /** DG1.6 - Diagnosis Type */
  $6_diagnosisType: DiagnosisType | string;
  /** DG1.7 - Major Diagnostic Category */
  $7_majorDiagnosticCategory?: CE;
  /** DG1.8 - Diagnostic Related Group */
  $8_diagnosticRelatedGroup?: CE;
  /** DG1.9 - DRG Approval Indicator */
  $9_drgApproval?: string;
  /** DG1.10 - DRG Grouper Review Code */
  $10_drgGrouperReviewCode?: string;
  /** DG1.11 - Outlier Type */
  $11_outlierType?: CE;
  /** DG1.12 - Outlier Days */
  $12_outlierDays?: string;
  /** DG1.13 - Outlier Cost */
  $13_outlierCost?: CP;
  /** DG1.14 - Grouper Version And Type */
  $14_grouperVersionAndType?: string;
  /** DG1.15 - Diagnosis Priority */
  $15_diagnosisPriority?: DiagnosisPriority | string;
  /** DG1.16 - Diagnosing Clinician */
  $16_diagnosingClinician?: XCN[];
  /** DG1.17 - Diagnosis Classification */
  $17_diagnosisClassification?: DiagnosisClassification | string;
  /** DG1.18 - Confidential Indicator */
  $18_confidentialIndicator?: string;
  /** DG1.19 - Attestation Date/Time */
  $19_attestationDateTime?: string;
  /** DG1.20 - Diagnosis Identifier */
  $20_diagnosisIdentifier?: EI;
  /** DG1.21 - Diagnosis Action Code */
  $21_diagnosisActionCode?: SegmentAction | string;
}

/** DRG Segment */
export interface DRG {
  /** DRG.1 - Diagnostic Related Group */
  $1_diagnosticRelatedGroup?: CE;
  /** DRG.2 - DRG Assigned Date/Time */
  $2_drgAssignedDateTime?: string;
  /** DRG.3 - DRG Approval Indicator */
  $3_drgApproval?: string;
  /** DRG.4 - DRG Grouper Review Code */
  $4_drgGrouperReviewCode?: string;
  /** DRG.5 - Outlier Type */
  $5_outlierType?: CE;
  /** DRG.6 - Outlier Days */
  $6_outlierDays?: string;
  /** DRG.7 - Outlier Cost */
  $7_outlierCost?: CP;
  /** DRG.8 - DRG Payor */
  $8_drgPayor?: string;
  /** DRG.9 - Outlier Reimbursement */
  $9_outlierReimbursement?: CP;
  /** DRG.10 - Confidential Indicator */
  $10_confidentialIndicator?: string;
  /** DRG.11 - DRG Transfer Type */
  $11_drgTransferType?: DrgTransferType | string;
}

/** DSC Segment */
export interface DSC {
  /** DSC.1 - Continuation Pointer */
  $1_continuationPointer?: string;
  /** DSC.2 - Continuation Style */
  $2_continuationStyle?: ContinuationStyle | string;
}

/** EVN Segment */
export interface EVN {
  /** EVN.1 - Event Type Code */
  $1_eventTypeCode?: Event | string;
  /** EVN.2 - Recorded Date/Time */
  $2_recordedDateTime: string;
  /** EVN.3 - Date/Time Planned Event */
  $3_plannedEventDateTime?: string;
  /** EVN.4 - Event Reason Code */
  $4_eventReasonCode?: EventReason | string;
  /** EVN.5 - Operator ID */
  $5_operatorId?: XCN[];
  /** EVN.6 - Event Occurred */
  $6_eventOccurred?: string;
  /** EVN.7 - Event Facility */
  $7_eventFacility?: HD;
}

/** FT1 Segment */
export interface FT1 {
  /** FT1.1 - Set ID - FT1 */
  $1_setIdFt1?: string;
  /** FT1.2 - Transaction ID */
  $2_transactionId?: string;
  /** FT1.3 - Transaction Batch ID */
  $3_transactionBatchId?: string;
  /** FT1.4 - Transaction Date */
  $4_transactionDate: DR;
  /** FT1.5 - Transaction Posting Date */
  $5_transactionPostingDate?: string;
  /** FT1.6 - Transaction Type */
  $6_transactionType: TransactionType | string;
  /** FT1.7 - Transaction Code */
  $7_transactionCode: CE;
  /** FT1.8 - Transaction Description */
  $8_transactionDescription?: string;
  /** FT1.9 - Transaction Description - Alt */
  $9_transactionDescriptionAlt?: string;
  /** FT1.10 - Transaction Quantity */
  $10_transactionQuantity?: string;
  /** FT1.11 - Transaction Amount - Extended */
  $11_transactionAmountExtended?: CP;
  /** FT1.12 - Transaction Amount - Unit */
  $12_transactionAmountUnit?: CP;
  /** FT1.13 - Department Code */
  $13_departmentCode?: CE;
  /** FT1.14 - Insurance Plan ID */
  $14_insurancePlanId?: CE;
  /** FT1.15 - Insurance Amount */
  $15_insuranceAmount?: CP;
  /** FT1.16 - Assigned Patient Location */
  $16_assignedPatientLocation?: PL;
  /** FT1.17 - Fee Schedule */
  $17_feeSchedule?: string;
  /** FT1.18 - Patient Type */
  $18_type?: string;
  /** FT1.19 - Diagnosis Code - FT1 */
  $19_diagnosisCodeFt1?: CE[];
  /** FT1.20 - Performed By Code */
  $20_performedByCode?: XCN[];
  /** FT1.21 - Ordered By Code */
  $21_orderedByCode?: XCN[];
  /** FT1.22 - Unit Cost */
  $22_unitCost?: CP;
  /** FT1.23 - Filler Order Number */
  $23_fillerOrderNumber?: EI;
  /** FT1.24 - Entered By Code */
  $24_enteredByCode?: XCN[];
  /** FT1.25 - Procedure Code */
  $25_procedureCode?: CE;
  /** FT1.26 - Procedure Code Modifier */
  $26_procedureCodeModifier?: CE[];
  /** FT1.27 - Advanced Beneficiary Notice Code */
  $27_advancedBeneficiaryNoticeCode?: CE;
  /** FT1.28 - Medically Necessary Duplicate Procedure Reason. */
  $28_medicallyNecessaryDuplicateProcedureReason?: CWE;
  /** FT1.29 - NDC Code */
  $29_ndcCode?: CNE;
  /** FT1.30 - Payment Reference ID */
  $30_paymentReferenceId?: CX;
  /** FT1.31 - Transaction Reference Key */
  $31_transactionReferenceKey?: string[];
}

/** GT1 Segment */
export interface GT1 {
  /** GT1.1 - Set ID - GT1 */
  $1_setIdGt1: string;
  /** GT1.2 - Guarantor Number */
  $2_guarantorNumber?: CX[];
  /** GT1.3 - Guarantor Name */
  $3_guarantorName: XPN[];
  /** GT1.4 - Guarantor Spouse Name */
  $4_guarantorSpouseName?: XPN[];
  /** GT1.5 - Guarantor Address */
  $5_guarantorAddress?: XAD[];
  /** GT1.6 - Guarantor Ph Num - Home */
  $6_guarantorPhNumHome?: XTN[];
  /** GT1.7 - Guarantor Ph Num - Business */
  $7_guarantorPhNumBusiness?: XTN[];
  /** GT1.8 - Guarantor Date/Time Of Birth */
  $8_birthDate?: string;
  /** GT1.9 - Guarantor Administrative Sex */
  $9_guarantorAdministrativeGender?: AdministrativeSex | string;
  /** GT1.10 - Guarantor Type */
  $10_guarantorType?: string;
  /** GT1.11 - Guarantor Relationship */
  $11_guarantorRelationship?: CE;
  /** GT1.12 - Guarantor SSN */
  $12_guarantorSsn?: string;
  /** GT1.13 - Guarantor Date - Begin */
  $13_guarantorDateBegin?: string;
  /** GT1.14 - Guarantor Date - End */
  $14_guarantorDateEnd?: string;
  /** GT1.15 - Guarantor Priority */
  $15_guarantorPriority?: string;
  /** GT1.16 - Guarantor Employer Name */
  $16_guarantorEmployerName?: XPN[];
  /** GT1.17 - Guarantor Employer Address */
  $17_guarantorEmployerAddress?: XAD[];
  /** GT1.18 - Guarantor Employer Phone Number */
  $18_guarantorEmployerPhoneNumber?: XTN[];
  /** GT1.19 - Guarantor Employee ID Number */
  $19_guarantorEmployeeIdNumber?: CX[];
  /** GT1.20 - Guarantor Employment Status */
  $20_guarantorEmploymentStatus?: EmploymentStatus | string;
  /** GT1.21 - Guarantor Organization Name */
  $21_guarantorOrganizationName?: XON[];
  /** GT1.22 - Guarantor Billing Hold Flag */
  $22_guarantorBillingHoldFlag?: string;
  /** GT1.23 - Guarantor Credit Rating Code */
  $23_guarantorCreditRatingCode?: CE;
  /** GT1.24 - Guarantor Death Date And Time */
  $24_guarantorDeathDateAndTime?: string;
  /** GT1.25 - Guarantor Death Flag */
  $25_guarantorDeathFlag?: string;
  /** GT1.26 - Guarantor Charge Adjustment Code */
  $26_guarantorChargeAdjustmentCode?: CE;
  /** GT1.27 - Guarantor Household Annual Income */
  $27_guarantorHouseholdAnnualIncome?: CP;
  /** GT1.28 - Guarantor Household Size */
  $28_guarantorHouseholdSize?: string;
  /** GT1.29 - Guarantor Employer ID Number */
  $29_guarantorEmployerIdNumber?: CX[];
  /** GT1.30 - Guarantor Marital Status Code */
  $30_guarantorMaritalStatusCode?: CE;
  /** GT1.31 - Guarantor Hire Effective Date */
  $31_guarantorHireEffectiveDate?: string;
  /** GT1.32 - Employment Stop Date */
  $32_employmentEnd?: string;
  /** GT1.33 - Living Dependency */
  $33_livingDependency?: LivingDependency2 | string;
  /** GT1.34 - Ambulatory Status */
  $34_ambulatoryStatus?: (AmbulatoryStatus | string)[];
  /** GT1.35 - Citizenship */
  $35_citizenship?: CE[];
  /** GT1.36 - Primary Language */
  $36_language?: CE;
  /** GT1.37 - Living Arrangement */
  $37_livingArrangement?: LivingArrangement | string;
  /** GT1.38 - Publicity Code */
  $38_publicityCode?: CE;
  /** GT1.39 - Protection Indicator */
  $39_protectionIndicator?: string;
  /** GT1.40 - Student Indicator */
  $40_student?: StudentStatus | string;
  /** GT1.41 - Religion */
  $41_religion?: CE;
  /** GT1.42 - Mother's Maiden Name */
  $42_mothersMaidenName?: XPN[];
  /** GT1.43 - Nationality */
  $43_nationality?: CE;
  /** GT1.44 - Ethnic Group */
  $44_ethnicity?: CE[];
  /** GT1.45 - Contact Person's Name */
  $45_contactPersonsName?: XPN[];
  /** GT1.46 - Contact Person's Telephone Number */
  $46_contactPhone?: XTN[];
  /** GT1.47 - Contact Reason */
  $47_contactReason?: CE;
  /** GT1.48 - Contact Relationship */
  $48_contactRelationship?: Relationship | string;
  /** GT1.49 - Job Title */
  $49_jobTitle?: string;
  /** GT1.50 - Job Code/Class */
  $50_jobCodeClass?: JCC;
  /** GT1.51 - Guarantor Employer's Organization Name */
  $51_guarantorEmployersOrganizationName?: XON[];
  /** GT1.52 - Handicap */
  $52_disability?: string;
  /** GT1.53 - Job Status */
  $53_jobStatus?: JobStatus | string;
  /** GT1.54 - Guarantor Financial Class */
  $54_guarantorFinancialClass?: FC;
  /** GT1.55 - Guarantor Race */
  $55_guarantorRace?: CE[];
  /** GT1.56 - Guarantor Birth Place */
  $56_guarantorBirthPlace?: string;
  /** GT1.57 - VIP Indicator */
  $57_vip?: string;
}

/** IN1 Segment */
export interface IN1 {
  /** IN1.1 - Set ID - IN1 */
  $1_setIdIn1: string;
  /** IN1.2 - Insurance Plan ID */
  $2_insurancePlanId: CE;
  /** IN1.3 - Insurance Company ID */
  $3_insuranceCompanyId: CX[];
  /** IN1.4 - Insurance Company Name */
  $4_insuranceCompanyName?: XON[];
  /** IN1.5 - Insurance Company Address */
  $5_insuranceCompanyAddress?: XAD[];
  /** IN1.6 - Insurance Co Contact Person */
  $6_insuranceCoContactPerson?: XPN[];
  /** IN1.7 - Insurance Co Phone Number */
  $7_insurancePhone?: XTN[];
  /** IN1.8 - Group Number */
  $8_groupNumber?: string;
  /** IN1.9 - Group Name */
  $9_groupName?: XON[];
  /** IN1.10 - Insured's Group Emp ID */
  $10_insuredsGroupEmpId?: CX[];
  /** IN1.11 - Insured's Group Emp Name */
  $11_insuredsGroupEmpName?: XON[];
  /** IN1.12 - Plan Effective Date */
  $12_planEffectiveDate?: string;
  /** IN1.13 - Plan Expiration Date */
  $13_planExpirationDate?: string;
  /** IN1.14 - Authorization Information */
  $14_authorizationInformation?: AUI;
  /** IN1.15 - Plan Type */
  $15_planType?: string;
  /** IN1.16 - Name Of Insured */
  $16_nameOfInsured?: XPN[];
  /** IN1.17 - Insured's Relationship To Patient */
  $17_insuredsRelationshipToPatient?: CE;
  /** IN1.18 - Insured's Date Of Birth */
  $18_insuredsDateOfBirth?: string;
  /** IN1.19 - Insured's Address */
  $19_insuredsAddress?: XAD[];
  /** IN1.20 - Assignment Of Benefits */
  $20_assignmentOfBenefits?: AssignmentOfBenefits | string;
  /** IN1.21 - Coordination Of Benefits */
  $21_coordinationOfBenefits?: CoordinationOfBenefits | string;
  /** IN1.22 - Coord Of Ben. Priority */
  $22_coordOfBenPriority?: string;
  /** IN1.23 - Notice Of Admission Flag */
  $23_noticeOfAdmissionFlag?: string;
  /** IN1.24 - Notice Of Admission Date */
  $24_noticeOfAdmissionDate?: string;
  /** IN1.25 - Report Of Eligibility Flag */
  $25_reportOfEligibilityFlag?: string;
  /** IN1.26 - Report Of Eligibility Date */
  $26_reportOfEligibilityDate?: string;
  /** IN1.27 - Release Information Code */
  $27_releaseInformationCode?: string;
  /** IN1.28 - Pre-Admit Cert (PAC) */
  $28_preAdmitCert?: string;
  /** IN1.29 - Verification Date/Time */
  $29_verificationDateTime?: string;
  /** IN1.30 - Verification By */
  $30_verificationBy?: XCN[];
  /** IN1.31 - Type Of Agreement Code */
  $31_typeOfAgreementCode?: TypeOfAgreement | string;
  /** IN1.32 - Billing Status */
  $32_billingStatus?: string;
  /** IN1.33 - Lifetime Reserve Days */
  $33_lifetimeReserveDays?: string;
  /** IN1.34 - Delay Before L.R. Day */
  $34_delayBeforeLRDay?: string;
  /** IN1.35 - Company Plan Code */
  $35_companyPlanCode?: string;
  /** IN1.36 - Policy Number */
  $36_policyNumber?: string;
  /** IN1.37 - Policy Deductible */
  $37_policyDeductible?: CP;
  /** IN1.38 - Policy Limit - Amount */
  $38_policyLimitAmount?: CP;
  /** IN1.39 - Policy Limit - Days */
  $39_policyLimitDays?: string;
  /** IN1.40 - Room Rate - Semi-Private */
  $40_roomRateSemiPrivate?: CP;
  /** IN1.41 - Room Rate - Private */
  $41_roomRatePrivate?: CP;
  /** IN1.42 - Insured's Employment Status */
  $42_insuredsEmploymentStatus?: CE;
  /** IN1.43 - Insured's Administrative Sex */
  $43_insuredsAdministrativeGender?: AdministrativeSex | string;
  /** IN1.44 - Insured's Employer's Address */
  $44_insuredsEmployersAddress?: XAD[];
  /** IN1.45 - Verification Status */
  $45_verificationStatus?: string;
  /** IN1.46 - Prior Insurance Plan ID */
  $46_priorInsurancePlanId?: string;
  /** IN1.47 - Coverage Type */
  $47_coverageType?: CoverageType | string;
  /** IN1.48 - Handicap */
  $48_disability?: string;
  /** IN1.49 - Insured's ID Number */
  $49_insuredsIdNumber?: CX[];
  /** IN1.50 - Signature Code */
  $50_signatureCode?: SignatureType | string;
  /** IN1.51 - Signature Code Date */
  $51_signatureCodeDate?: string;
  /** IN1.52 - Insured's Birth Place */
  $52_insuredsBirthPlace?: string;
  /** IN1.53 - VIP Indicator */
  $53_vip?: string;
}

/** IN2 Segment */
export interface IN2 {
  /** IN2.1 - Insured's Employee ID */
  $1_insuredsEmployeeId?: CX[];
  /** IN2.2 - Insured's Social Security Number */
  $2_insuredsSocialSecurityNumber?: string;
  /** IN2.3 - Insured's Employer's Name and ID */
  $3_insuredsEmployersNameAndId?: XCN[];
  /** IN2.4 - Employer Information Data */
  $4_employerInformationData?: string;
  /** IN2.5 - Mail Claim Party */
  $5_mailClaimParty?: (MailClaimParty | string)[];
  /** IN2.6 - Medicare Health Ins Card Number */
  $6_medicareHealthInsCardNumber?: string;
  /** IN2.7 - Medicaid Case Name */
  $7_medicaidCaseName?: XPN[];
  /** IN2.8 - Medicaid Case Number */
  $8_medicaidCaseNumber?: string;
  /** IN2.9 - Military Sponsor Name */
  $9_militarySponsorName?: XPN[];
  /** IN2.10 - Military ID Number */
  $10_militaryIdNumber?: string;
  /** IN2.11 - Dependent Of Military Recipient */
  $11_dependentOfMilitaryRecipient?: CE;
  /** IN2.12 - Military Organization */
  $12_militaryOrganization?: string;
  /** IN2.13 - Military Station */
  $13_militaryStation?: string;
  /** IN2.14 - Military Service */
  $14_militaryService?: MilitaryService | string;
  /** IN2.15 - Military Rank/Grade */
  $15_militaryRankGrade?: string;
  /** IN2.16 - Military Status */
  $16_militaryStatus?: MilitaryStatus | string;
  /** IN2.17 - Military Retire Date */
  $17_militaryRetireDate?: string;
  /** IN2.18 - Military Non-Avail Cert On File */
  $18_militaryNonAvailCertOnFile?: string;
  /** IN2.19 - Baby Coverage */
  $19_babyCoverage?: string;
  /** IN2.20 - Combine Baby Bill */
  $20_combineBabyBill?: string;
  /** IN2.21 - Blood Deductible */
  $21_bloodDeductible?: string;
  /** IN2.22 - Special Coverage Approval Name */
  $22_specialCoverageApprovalName?: XPN[];
  /** IN2.23 - Special Coverage Approval Title */
  $23_specialCoverageApprovalTitle?: string;
  /** IN2.24 - Non-Covered Insurance Code */
  $24_nonCoveredInsuranceCode?: string[];
  /** IN2.25 - Payor ID */
  $25_payorId?: CX[];
  /** IN2.26 - Payor Subscriber ID */
  $26_payorSubscriberId?: CX[];
  /** IN2.27 - Eligibility Source */
  $27_eligibilitySource?: EligibilitySource | string;
  /** IN2.28 - Room Coverage Type/Amount */
  $28_roomCoverageTypeAmount?: RMC[];
  /** IN2.29 - Policy Type/Amount */
  $29_policyTypeAmount?: PTA[];
  /** IN2.30 - Daily Deductible */
  $30_dailyDeductible?: DDI;
  /** IN2.31 - Living Dependency */
  $31_livingDependency?: LivingDependency2 | string;
  /** IN2.32 - Ambulatory Status */
  $32_ambulatoryStatus?: (AmbulatoryStatus | string)[];
  /** IN2.33 - Citizenship */
  $33_citizenship?: CE[];
  /** IN2.34 - Primary Language */
  $34_language?: CE;
  /** IN2.35 - Living Arrangement */
  $35_livingArrangement?: LivingArrangement | string;
  /** IN2.36 - Publicity Code */
  $36_publicityCode?: CE;
  /** IN2.37 - Protection Indicator */
  $37_protectionIndicator?: string;
  /** IN2.38 - Student Indicator */
  $38_student?: StudentStatus | string;
  /** IN2.39 - Religion */
  $39_religion?: CE;
  /** IN2.40 - Mother's Maiden Name */
  $40_mothersMaidenName?: XPN[];
  /** IN2.41 - Nationality */
  $41_nationality?: CE;
  /** IN2.42 - Ethnic Group */
  $42_ethnicity?: CE[];
  /** IN2.43 - Marital Status */
  $43_maritalStatus?: CE[];
  /** IN2.44 - Insured's Employment Start Date */
  $44_insuredsEmploymentStartDate?: string;
  /** IN2.45 - Employment Stop Date */
  $45_employmentEnd?: string;
  /** IN2.46 - Job Title */
  $46_jobTitle?: string;
  /** IN2.47 - Job Code/Class */
  $47_jobCodeClass?: JCC;
  /** IN2.48 - Job Status */
  $48_jobStatus?: JobStatus | string;
  /** IN2.49 - Employer Contact Person Name */
  $49_employerContactPersonName?: XPN[];
  /** IN2.50 - Employer Contact Person Phone Number */
  $50_employerContactPhone?: XTN[];
  /** IN2.51 - Employer Contact Reason */
  $51_employerContactReason?: string;
  /** IN2.52 - Insured's Contact Person's Name */
  $52_insuredsContactPersonsName?: XPN[];
  /** IN2.53 - Insured's Contact Person Phone Number */
  $53_insuredContactPhone?: XTN[];
  /** IN2.54 - Insured's Contact Person Reason */
  $54_insuredsContactPersonReason?: string[];
  /** IN2.55 - Relationship to the Patient Start Date */
  $55_relationshipToThePatientStartDate?: string;
  /** IN2.56 - Relationship to the Patient Stop Date */
  $56_relationshipToThePatientStopDate?: string[];
  /** IN2.57 - Insurance Co. Contact Reason */
  $57_insuranceCoContactReason?: InsuranceCompanyContactReason | string;
  /** IN2.58 - Insurance Co Contact Phone Number */
  $58_insuranceContactPhone?: XTN;
  /** IN2.59 - Policy Scope */
  $59_policyScope?: string;
  /** IN2.60 - Policy Source */
  $60_policySource?: string;
  /** IN2.61 - Patient Member Number */
  $61_memberNumber?: CX;
  /** IN2.62 - Guarantor's Relationship to Insured */
  $62_guarantorsRelationshipToInsured?: CE;
  /** IN2.63 - Insured's Phone Number - Home */
  $63_insuredHomePhone?: XTN[];
  /** IN2.64 - Insured's Employer Phone Number */
  $64_insuredEmployerPhone?: XTN[];
  /** IN2.65 - Military Handicapped Program */
  $65_militaryHandicappedProgram?: CE;
  /** IN2.66 - Suspend Flag */
  $66_suspendFlag?: string;
  /** IN2.67 - Copay Limit Flag */
  $67_copayLimitFlag?: string;
  /** IN2.68 - Stoploss Limit Flag */
  $68_stoplossLimitFlag?: string;
  /** IN2.69 - Insured Organization Name and ID */
  $69_insuredOrganizationNameAndId?: XON[];
  /** IN2.70 - Insured Employer Organization Name and ID */
  $70_insuredEmployerOrganizationNameAndId?: XON[];
  /** IN2.71 - Race */
  $71_race?: CE[];
  /** IN2.72 - CMS Patient's Relationship to Insured */
  $72_cmsPatientsRelationshipToInsured?: CE;
}

/** IN3 Segment */
export interface IN3 {
  /** IN3.1 - Set ID - IN3 */
  $1_setIdIn3: string;
  /** IN3.2 - Certification Number */
  $2_certificationNumber?: CX;
  /** IN3.3 - Certified By */
  $3_certifiedBy?: XCN[];
  /** IN3.4 - Certification Required */
  $4_required?: string;
  /** IN3.5 - Penalty */
  $5_penalty?: MOP;
  /** IN3.6 - Certification Date/Time */
  $6_certificationDateTime?: string;
  /** IN3.7 - Certification Modify Date/Time */
  $7_certificationModifyDateTime?: string;
  /** IN3.8 - Operator */
  $8_operator?: XCN[];
  /** IN3.9 - Certification Begin Date */
  $9_certificationBeginDate?: string;
  /** IN3.10 - Certification End Date */
  $10_certificationEndDate?: string;
  /** IN3.11 - Days */
  $11_days?: DTN;
  /** IN3.12 - Non-Concur Code/Description */
  $12_nonConcurCodeDescription?: CE;
  /** IN3.13 - Non-Concur Effective Date/Time */
  $13_nonConcurEffectiveDateTime?: string;
  /** IN3.14 - Physician Reviewer */
  $14_physicianReviewer?: XCN[];
  /** IN3.15 - Certification Contact */
  $15_certificationContact?: string;
  /** IN3.16 - Certification Contact Phone Number */
  $16_certificationContactPhoneNumber?: XTN[];
  /** IN3.17 - Appeal Reason */
  $17_appealReason?: CE;
  /** IN3.18 - Certification Agency */
  $18_certificationAgency?: CE;
  /** IN3.19 - Certification Agency Phone Number */
  $19_certificationAgencyPhoneNumber?: XTN[];
  /** IN3.20 - Pre-Certification Requirement */
  $20_preCertificationRequirement?: ICD[];
  /** IN3.21 - Case Manager */
  $21_caseManager?: string;
  /** IN3.22 - Second Opinion Date */
  $22_secondOpinionDate?: string;
  /** IN3.23 - Second Opinion Status */
  $23_secondOpinionStatus?: string;
  /** IN3.24 - Second Opinion Documentation Received */
  $24_secondOpinionDocumentationReceived?: string[];
  /** IN3.25 - Second Opinion Physician */
  $25_secondOpinionPhysician?: XCN[];
}

/** MSH Segment */
export interface MSH {
  /** MSH.1 - Field Separator */
  $1_fieldSeparator?: string;
  /** MSH.2 - Encoding Characters */
  $2_encodingCharacters?: string;
  /** MSH.3 - Sending Application */
  $3_sendingApplication?: HD;
  /** MSH.4 - Sending Facility */
  $4_sendingFacility?: HD;
  /** MSH.5 - Receiving Application */
  $5_receivingApplication?: HD;
  /** MSH.6 - Receiving Facility */
  $6_receivingFacility?: HD;
  /** MSH.7 - Date/Time Of Message */
  $7_messageDateTime: string;
  /** MSH.8 - Security */
  $8_security?: string;
  /** MSH.9 - Message Type */
  $9_messageType: MSG;
  /** MSH.10 - Message Control ID */
  $10_messageControlId: string;
  /** MSH.11 - Processing ID */
  $11_processingId: PT;
  /** MSH.12 - Version ID */
  $12_version: VID;
  /** MSH.13 - Sequence Number */
  $13_sequenceNumber?: string;
  /** MSH.14 - Continuation Pointer */
  $14_continuationPointer?: string;
  /** MSH.15 - Accept Acknowledgment Type */
  $15_acceptAcknowledgmentType?: AcceptApplicationAcknowledgmentConditions | string;
  /** MSH.16 - Application Acknowledgment Type */
  $16_applicationAcknowledgmentType?: AcceptApplicationAcknowledgmentConditions | string;
  /** MSH.17 - Country Code */
  $17_countryCode?: string;
  /** MSH.18 - Character Set */
  $18_characterSet?: (AlternateCharacterSets | string)[];
  /** MSH.19 - Principal Language Of Message */
  $19_principalLanguageOfMessage?: CE;
  /** MSH.20 - Alternate Character Set Handling Scheme */
  $20_alternateCharacterSetHandlingScheme?: AlternateCharacterSetHandlingScheme | string;
  /** MSH.21 - Message Profile Identifier */
  $21_messageProfileIdentifier?: EI[];
}

/** NK1 Segment */
export interface NK1 {
  /** NK1.1 - Set ID - NK1 */
  $1_setIdNk1: string;
  /** NK1.2 - Name */
  $2_name?: XPN[];
  /** NK1.3 - Relationship */
  $3_relationship?: CE;
  /** NK1.4 - Address */
  $4_text?: XAD[];
  /** NK1.5 - Phone Number */
  $5_phone?: XTN[];
  /** NK1.6 - Business Phone Number */
  $6_businessPhone?: XTN[];
  /** NK1.7 - Contact Role */
  $7_contactRole?: CE;
  /** NK1.8 - Start Date */
  $8_startDate?: string;
  /** NK1.9 - End Date */
  $9_endDate?: string;
  /** NK1.10 - Next of Kin / Associated Parties Job Title */
  $10_nextOfKinAssociatedPartiesJobTitle?: string;
  /** NK1.11 - Next of Kin / Associated Parties Job Code/Class */
  $11_nextOfKinAssociatedPartiesJobCodeClass?: JCC;
  /** NK1.12 - Next of Kin / Associated Parties Employee Number */
  $12_nextOfKinAssociatedPartiesEmployeeNumber?: CX;
  /** NK1.13 - Organization Name - NK1 */
  $13_organizationNameNk1?: XON[];
  /** NK1.14 - Marital Status */
  $14_maritalStatus?: CE;
  /** NK1.15 - Administrative Sex */
  $15_gender?: AdministrativeSex | string;
  /** NK1.16 - Date/Time of Birth */
  $16_birthDate?: string;
  /** NK1.17 - Living Dependency */
  $17_livingDependency?: (LivingDependency2 | string)[];
  /** NK1.18 - Ambulatory Status */
  $18_ambulatoryStatus?: (AmbulatoryStatus | string)[];
  /** NK1.19 - Citizenship */
  $19_citizenship?: CE[];
  /** NK1.20 - Primary Language */
  $20_language?: CE;
  /** NK1.21 - Living Arrangement */
  $21_livingArrangement?: LivingArrangement | string;
  /** NK1.22 - Publicity Code */
  $22_publicityCode?: CE;
  /** NK1.23 - Protection Indicator */
  $23_protectionIndicator?: string;
  /** NK1.24 - Student Indicator */
  $24_student?: StudentStatus | string;
  /** NK1.25 - Religion */
  $25_religion?: CE;
  /** NK1.26 - Mother's Maiden Name */
  $26_mothersMaidenName?: XPN[];
  /** NK1.27 - Nationality */
  $27_nationality?: CE;
  /** NK1.28 - Ethnic Group */
  $28_ethnicity?: CE[];
  /** NK1.29 - Contact Reason */
  $29_contactReason?: CE[];
  /** NK1.30 - Contact Person's Name */
  $30_contactPersonsName?: XPN[];
  /** NK1.31 - Contact Person's Telephone Number */
  $31_contactPhone?: XTN[];
  /** NK1.32 - Contact Person's Address */
  $32_contactPersonsAddress?: XAD[];
  /** NK1.33 - Next of Kin/Associated Party's Identifiers */
  $33_nextOfKinAssociatedPartysIdentifiers?: CX[];
  /** NK1.34 - Job Status */
  $34_jobStatus?: JobStatus | string;
  /** NK1.35 - Race */
  $35_race?: CE[];
  /** NK1.36 - Handicap */
  $36_disability?: string;
  /** NK1.37 - Contact Person Social Security Number */
  $37_contactPersonSocialSecurityNumber?: string;
  /** NK1.38 - Next of Kin Birth Place */
  $38_nextOfKinBirthPlace?: string;
  /** NK1.39 - VIP Indicator */
  $39_vip?: string;
}

/** NTE Segment */
export interface NTE {
  /** NTE.1 - Set ID - NTE */
  $1_setIdNte?: string;
  /** NTE.2 - Source of Comment */
  $2_sourceOfComment?: SourceOfComment | string;
  /** NTE.3 - Comment */
  $3_comment?: string[];
  /** NTE.4 - Comment Type */
  $4_commentType?: CE;
}

/** OBR Segment */
export interface OBR {
  /** OBR.1 - Set ID - OBR */
  $1_setIdObr?: string;
  /** OBR.2 - Placer Order Number */
  $2_placerOrderNumber?: EI;
  /** OBR.3 - Filler Order Number */
  $3_fillerOrderNumber?: EI;
  /** OBR.4 - Universal Service Identifier */
  $4_service: CE;
  /** OBR.5 - Priority - OBR */
  $5_priorityObr?: string;
  /** OBR.6 - Requested Date/Time */
  $6_requestedDateTime?: string;
  /** OBR.7 - Observation Date/Time */
  $7_observationDateTime?: string;
  /** OBR.8 - Observation End Date/Time */
  $8_observationEndDateTime?: string;
  /** OBR.9 - Collection Volume */
  $9_collectionVolume?: CQ;
  /** OBR.10 - Collector Identifier */
  $10_collectorIdentifier?: XCN[];
  /** OBR.11 - Specimen Action Code */
  $11_specimenActionCode?: SpecimenAction | string;
  /** OBR.12 - Danger Code */
  $12_dangerCode?: CE;
  /** OBR.13 - Relevant Clinical Information */
  $13_relevantClinicalInformation?: string;
  /** OBR.14 - Specimen Received Date/Time */
  $14_specimenReceived?: string;
  /** OBR.15 - Specimen Source */
  $15_specimenSource?: SPS;
  /** OBR.16 - Ordering Provider */
  $16_orderingProvider?: XCN[];
  /** OBR.17 - Order Callback Phone Number */
  $17_callbackPhone?: XTN[];
  /** OBR.18 - Placer Field 1 */
  $18_placerField1?: string;
  /** OBR.19 - Placer Field 2 */
  $19_placerField2?: string;
  /** OBR.20 - Filler Field 1 */
  $20_fillerField1?: string;
  /** OBR.21 - Filler Field 2 */
  $21_fillerField2?: string;
  /** OBR.22 - Results Rpt/Status Chng - Date/Time */
  $22_resultsRptStatusChngDateTime?: string;
  /** OBR.23 - Charge to Practice */
  $23_chargeToPractice?: MOC;
  /** OBR.24 - Diagnostic Serv Sect ID */
  $24_diagnosticServSectId?: DiagnosticServiceSectionId | string;
  /** OBR.25 - Result Status */
  $25_resultStatus?: ResultStatus | string;
  /** OBR.26 - Parent Result */
  $26_parentResult?: PRL;
  /** OBR.27 - Quantity/Timing */
  $27_timing?: TQ[];
  /** OBR.28 - Result Copies To */
  $28_resultCopiesTo?: XCN[];
  /** OBR.29 - Parent */
  $29_parent?: EIP;
  /** OBR.30 - Transportation Mode */
  $30_transportationMode?: TransportationMode | string;
  /** OBR.31 - Reason for Study */
  $31_reasonForStudy?: CE[];
  /** OBR.32 - Principal Result Interpreter */
  $32_principalResultInterpreter?: NDL;
  /** OBR.33 - Assistant Result Interpreter */
  $33_assistantResultInterpreter?: NDL[];
  /** OBR.34 - Technician */
  $34_technician?: NDL[];
  /** OBR.35 - Transcriptionist */
  $35_transcriptionist?: NDL[];
  /** OBR.36 - Scheduled Date/Time */
  $36_scheduledDateTime?: string;
  /** OBR.37 - Number of Sample Containers * */
  $37_numberOfSampleContainers?: string;
  /** OBR.38 - Transport Logistics of Collected Sample */
  $38_transportLogisticsOfCollectedSample?: CE[];
  /** OBR.39 - Collector's Comment * */
  $39_collectorsComment?: CE[];
  /** OBR.40 - Transport Arrangement Responsibility */
  $40_transportArrangementResponsibility?: CE;
  /** OBR.41 - Transport Arranged */
  $41_transportArranged?: TransportArranged | string;
  /** OBR.42 - Escort Required */
  $42_escortRequired?: EscortRequired | string;
  /** OBR.43 - Planned Patient Transport Comment */
  $43_plannedPatientTransportComment?: CE[];
  /** OBR.44 - Procedure Code */
  $44_procedureCode?: CE;
  /** OBR.45 - Procedure Code Modifier */
  $45_procedureCodeModifier?: CE[];
  /** OBR.46 - Placer Supplemental Service Information */
  $46_placerSupplementalInfo?: CE[];
  /** OBR.47 - Filler Supplemental Service Information */
  $47_fillerSupplementalInfo?: CE[];
  /** OBR.48 - Medically Necessary Duplicate Procedure Reason. */
  $48_medicallyNecessaryDuplicateProcedureReason?: CWE;
  /** OBR.49 - Result Handling */
  $49_resultHandling?: ObservationResultHandling | string;
  /** OBR.50 - Parent Universal Service Identifier */
  $50_parentUniversalServiceIdentifier?: CWE;
}

/** OBX Segment */
export interface OBX {
  /** OBX.1 - Set ID - OBX */
  $1_setIdObx?: string;
  /** OBX.2 - Value Type */
  $2_valueType?: string;
  /** OBX.3 - Observation Identifier */
  $3_observationIdentifier: CE;
  /** OBX.4 - Observation Sub-ID */
  $4_observationSubId?: string;
  /** OBX.5 - Observation Value */
  $5_observationValue?: string[];
  /** OBX.6 - Units */
  $6_unit?: CE;
  /** OBX.7 - References Range */
  $7_referencesRange?: string;
  /** OBX.8 - Abnormal Flags */
  $8_abnormalFlags?: string[];
  /** OBX.9 - Probability */
  $9_probability?: string;
  /** OBX.10 - Nature of Abnormal Test */
  $10_natureOfAbnormalTest?: (NatureOfAbnormalTesting | string)[];
  /** OBX.11 - Observation Result Status */
  $11_observationResultStatus: ObservationResultStatusCodesInterpretation | string;
  /** OBX.12 - Effective Date of Reference Range Values */
  $12_effectiveDateOfReferenceRangeValues?: string;
  /** OBX.13 - User Defined Access Checks */
  $13_userDefinedAccessChecks?: string;
  /** OBX.14 - Date/Time of the Observation */
  $14_observationDateTime?: string;
  /** OBX.15 - Producer's Reference */
  $15_producersReference?: CE;
  /** OBX.16 - Responsible Observer */
  $16_responsibleObserver?: XCN[];
  /** OBX.17 - Observation Method */
  $17_observationMethod?: CE[];
  /** OBX.18 - Equipment Instance Identifier */
  $18_equipmentInstanceIdentifier?: EI[];
  /** OBX.19 - Date/Time of the Analysis */
  $19_analysisDateTime?: string;
  /** OBX.20 - Observation Site */
  $20_observationSite?: CWE[];
  /** OBX.21 - Observation Instance Identifier */
  $21_observationInstanceIdentifier?: EI;
  /** OBX.22 - Mood Identifier */
  $22_moodIdentifier?: CNE;
  /** OBX.23 - Performing Organization Name */
  $23_performingOrganizationName?: XON;
  /** OBX.24 - Performing Organization Address */
  $24_performingOrganizationAddress?: XAD;
  /** OBX.25 - Performing Organization Medical Director */
  $25_performingOrganizationMedicalDirector?: XCN;
}

/** ORC Segment */
export interface ORC {
  /** ORC.1 - Order Control */
  $1_orderControl: OrderControlCodes | string;
  /** ORC.2 - Placer Order Number */
  $2_placerOrderNumber?: EI;
  /** ORC.3 - Filler Order Number */
  $3_fillerOrderNumber?: EI;
  /** ORC.4 - Placer Group Number */
  $4_placerGroupNumber?: EI;
  /** ORC.5 - Order Status */
  $5_orderStatus?: OrderStatus | string;
  /** ORC.6 - Response Flag */
  $6_responseFlag?: ResponseFlag | string;
  /** ORC.7 - Quantity/Timing */
  $7_timing?: TQ[];
  /** ORC.8 - Parent */
  $8_parent?: EIP;
  /** ORC.9 - Date/Time of Transaction */
  $9_transactionDateTime?: string;
  /** ORC.10 - Entered By */
  $10_enteredBy?: XCN[];
  /** ORC.11 - Verified By */
  $11_verifiedBy?: XCN[];
  /** ORC.12 - Ordering Provider */
  $12_orderingProvider?: XCN[];
  /** ORC.13 - Enterer's Location */
  $13_enterersLocation?: PL;
  /** ORC.14 - Call Back Phone Number */
  $14_callbackPhone?: XTN[];
  /** ORC.15 - Order Effective Date/Time */
  $15_orderEffectiveDateTime?: string;
  /** ORC.16 - Order Control Code Reason */
  $16_orderControlCodeReason?: CE;
  /** ORC.17 - Entering Organization */
  $17_enteringOrganization?: CE;
  /** ORC.18 - Entering Device */
  $18_enteringDevice?: CE;
  /** ORC.19 - Action By */
  $19_actionBy?: XCN[];
  /** ORC.20 - Advanced Beneficiary Notice Code */
  $20_advancedBeneficiaryNoticeCode?: CE;
  /** ORC.21 - Ordering Facility Name */
  $21_orderingFacilityName?: XON[];
  /** ORC.22 - Ordering Facility Address */
  $22_orderingFacilityAddress?: XAD[];
  /** ORC.23 - Ordering Facility Phone Number */
  $23_orderingFacilityPhoneNumber?: XTN[];
  /** ORC.24 - Ordering Provider Address */
  $24_orderingProviderAddress?: XAD[];
  /** ORC.25 - Order Status Modifier */
  $25_orderStatusModifier?: CWE;
  /** ORC.26 - Advanced Beneficiary Notice Override Reason */
  $26_advancedBeneficiaryNoticeOverrideReason?: CWE;
  /** ORC.27 - Filler's Expected Availability Date/Time */
  $27_fillersExpectedAvailabilityDateTime?: string;
  /** ORC.28 - Confidentiality Code */
  $28_confidentialityCode?: CWE;
  /** ORC.29 - Order Type */
  $29_orderType?: CWE;
  /** ORC.30 - Enterer Authorization Mode */
  $30_entererAuthorizationMode?: CNE;
  /** ORC.31 - Parent Universal Service Identifier */
  $31_parentUniversalServiceIdentifier?: CWE;
}

/** PD1 Segment */
export interface PD1 {
  /** PD1.1 - Living Dependency */
  $1_livingDependency?: (LivingDependency2 | string)[];
  /** PD1.2 - Living Arrangement */
  $2_livingArrangement?: LivingArrangement | string;
  /** PD1.3 - Patient Primary Facility */
  $3_primaryFacility?: XON[];
  /** PD1.4 - Patient Primary Care Provider Name & ID No. */
  $4_primaryCareProvider?: XCN[];
  /** PD1.5 - Student Indicator */
  $5_student?: StudentStatus | string;
  /** PD1.6 - Handicap */
  $6_disability?: string;
  /** PD1.7 - Living Will Code */
  $7_livingWill?: LivingWillCodes | string;
  /** PD1.8 - Organ Donor Code */
  $8_organDonorCode?: OrganDonorCodes | string;
  /** PD1.9 - Separate Bill */
  $9_separateBill?: string;
  /** PD1.10 - Duplicate Patient */
  $10_duplicatePatient?: CX[];
  /** PD1.11 - Publicity Code */
  $11_publicityCode?: CE;
  /** PD1.12 - Protection Indicator */
  $12_protectionIndicator?: string;
  /** PD1.13 - Protection Indicator Effective Date */
  $13_protectionIndicatorEffectiveDate?: string;
  /** PD1.14 - Place of Worship */
  $14_placeOfWorship?: XON[];
  /** PD1.15 - Advance Directive Code */
  $15_advanceDirectiveCode?: CE[];
  /** PD1.16 - Immunization Registry Status */
  $16_immunizationRegistryStatus?: ImmunizationRegistryStatus | string;
  /** PD1.17 - Immunization Registry Status Effective Date */
  $17_immunizationRegistryStatusEffectiveDate?: string;
  /** PD1.18 - Publicity Code Effective Date */
  $18_publicityCodeEffectiveDate?: string;
  /** PD1.19 - Military Branch */
  $19_militaryBranch?: MilitaryService | string;
  /** PD1.20 - Military Rank/Grade */
  $20_militaryRankGrade?: string;
  /** PD1.21 - Military Status */
  $21_militaryStatus?: MilitaryStatus | string;
}

/** PID Segment */
export interface PID {
  /** PID.1 - Set ID - PID */
  $1_setIdPid?: string;
  /** PID.2 - Patient ID */
  $2_patientId?: CX;
  /** PID.3 - Patient Identifier List */
  $3_identifier: CX[];
  /** PID.4 - Alternate Patient ID - PID */
  $4_alternatePatientIdPid?: CX[];
  /** PID.5 - Patient Name */
  $5_name: XPN[];
  /** PID.6 - Mother's Maiden Name */
  $6_mothersMaidenName?: XPN[];
  /** PID.7 - Date/Time of Birth */
  $7_birthDate?: string;
  /** PID.8 - Administrative Sex */
  $8_gender?: AdministrativeSex | string;
  /** PID.9 - Patient Alias */
  $9_alias?: XPN[];
  /** PID.10 - Race */
  $10_race?: CE[];
  /** PID.11 - Patient Address */
  $11_address?: XAD[];
  /** PID.12 - County Code */
  $12_countyCode?: string;
  /** PID.13 - Phone Number - Home */
  $13_homePhone?: XTN[];
  /** PID.14 - Phone Number - Business */
  $14_businessPhone?: XTN[];
  /** PID.15 - Primary Language */
  $15_language?: CE;
  /** PID.16 - Marital Status */
  $16_maritalStatus?: CE;
  /** PID.17 - Religion */
  $17_religion?: CE;
  /** PID.18 - Patient Account Number */
  $18_accountNumber?: CX;
  /** PID.19 - SSN Number - Patient */
  $19_ssnNumberPatient?: string;
  /** PID.20 - Driver's License Number - Patient */
  $20_driversLicenseNumberPatient?: DLN;
  /** PID.21 - Mother's Identifier */
  $21_mothersIdentifier?: CX[];
  /** PID.22 - Ethnic Group */
  $22_ethnicity?: CE[];
  /** PID.23 - Birth Place */
  $23_birthPlace?: string;
  /** PID.24 - Multiple Birth Indicator */
  $24_multipleBirthIndicator?: string;
  /** PID.25 - Birth Order */
  $25_birthOrder?: string;
  /** PID.26 - Citizenship */
  $26_citizenship?: CE[];
  /** PID.27 - Veterans Military Status */
  $27_veteransMilitaryStatus?: CE;
  /** PID.28 - Nationality */
  $28_nationality?: CE;
  /** PID.29 - Patient Death Date and Time */
  $29_deceasedDateTime?: string;
  /** PID.30 - Patient Death Indicator */
  $30_deceased?: string;
  /** PID.31 - Identity Unknown Indicator */
  $31_identityUnknownIndicator?: string;
  /** PID.32 - Identity Reliability Code */
  $32_identityReliabilityCode?: (IdentityReliability | string)[];
  /** PID.33 - Last Update Date/Time */
  $33_lastUpdateDateTime?: string;
  /** PID.34 - Last Update Facility */
  $34_lastUpdateFacility?: HD;
  /** PID.35 - Species Code */
  $35_speciesCode?: CE;
  /** PID.36 - Breed Code */
  $36_breedCode?: CE;
  /** PID.37 - Strain */
  $37_strain?: string;
  /** PID.38 - Production Class Code */
  $38_productionClassCode?: CE;
  /** PID.39 - Tribal Citizenship */
  $39_tribalCitizenship?: CWE[];
}

/** PR1 Segment */
export interface PR1 {
  /** PR1.1 - Set ID - PR1 */
  $1_setIdPr1: string;
  /** PR1.2 - Procedure Coding Method */
  $2_procedureCodingMethod?: string;
  /** PR1.3 - Procedure Code */
  $3_procedureCode: CE;
  /** PR1.4 - Procedure Description */
  $4_procedureDescription?: string;
  /** PR1.5 - Procedure Date/Time */
  $5_procedureDateTime: string;
  /** PR1.6 - Procedure Functional Type */
  $6_procedureFunctionalType?: ProcedureFunctionalType | string;
  /** PR1.7 - Procedure Minutes */
  $7_procedureMinutes?: string;
  /** PR1.8 - Anesthesiologist */
  $8_anesthesiologist?: XCN[];
  /** PR1.9 - Anesthesia Code */
  $9_anesthesiaCode?: string;
  /** PR1.10 - Anesthesia Minutes */
  $10_anesthesiaMinutes?: string;
  /** PR1.11 - Surgeon */
  $11_surgeon?: XCN[];
  /** PR1.12 - Procedure Practitioner */
  $12_procedurePractitioner?: XCN[];
  /** PR1.13 - Consent Code */
  $13_consentCode?: CE;
  /** PR1.14 - Procedure Priority */
  $14_procedurePriority?: ProcedurePriority | string;
  /** PR1.15 - Associated Diagnosis Code */
  $15_associatedDiagnosisCode?: CE;
  /** PR1.16 - Procedure Code Modifier */
  $16_procedureCodeModifier?: CE[];
  /** PR1.17 - Procedure DRG Type */
  $17_procedureDrgType?: ProcedureDrgType | string;
  /** PR1.18 - Tissue Type Code */
  $18_tissueTypeCode?: CE[];
  /** PR1.19 - Procedure Identifier */
  $19_procedureIdentifier?: EI;
  /** PR1.20 - Procedure Action Code */
  $20_procedureActionCode?: SegmentAction | string;
}

/** PV1 Segment */
export interface PV1 {
  /** PV1.1 - Set ID - PV1 */
  $1_setIdPv1?: string;
  /** PV1.2 - Patient Class */
  $2_class: PatientClass | string;
  /** PV1.3 - Assigned Patient Location */
  $3_assignedPatientLocation?: PL;
  /** PV1.4 - Admission Type */
  $4_admissionType?: AdmissionType | string;
  /** PV1.5 - Preadmit Number */
  $5_preadmitNumber?: CX;
  /** PV1.6 - Prior Patient Location */
  $6_priorPatientLocation?: PL;
  /** PV1.7 - Attending Doctor */
  $7_attendingDoctor?: XCN[];
  /** PV1.8 - Referring Doctor */
  $8_referringDoctor?: XCN[];
  /** PV1.9 - Consulting Doctor */
  $9_consultingDoctor?: XCN[];
  /** PV1.10 - Hospital Service */
  $10_hospitalService?: HospitalService | string;
  /** PV1.11 - Temporary Location */
  $11_temporaryLocation?: PL;
  /** PV1.12 - Preadmit Test Indicator */
  $12_preadmitTestIndicator?: string;
  /** PV1.13 - Re-admission Indicator */
  $13_reAdmissionIndicator?: ReAdmissionIndicator | string;
  /** PV1.14 - Admit Source */
  $14_admitSource?: string;
  /** PV1.15 - Ambulatory Status */
  $15_ambulatoryStatus?: (AmbulatoryStatus | string)[];
  /** PV1.16 - VIP Indicator */
  $16_vip?: string;
  /** PV1.17 - Admitting Doctor */
  $17_admittingDoctor?: XCN[];
  /** PV1.18 - Patient Type */
  $18_type?: string;
  /** PV1.19 - Visit Number */
  $19_visitNumber?: CX;
  /** PV1.20 - Financial Class */
  $20_financialClass?: FC[];
  /** PV1.21 - Charge Price Indicator */
  $21_chargePriceIndicator?: string;
  /** PV1.22 - Courtesy Code */
  $22_courtesyCode?: string;
  /** PV1.23 - Credit Rating */
  $23_creditRating?: string;
  /** PV1.24 - Contract Code */
  $24_contractCode?: string[];
  /** PV1.25 - Contract Effective Date */
  $25_contractEffectiveDate?: string[];
  /** PV1.26 - Contract Amount */
  $26_contractAmount?: string[];
  /** PV1.27 - Contract Period */
  $27_contractPeriod?: string[];
  /** PV1.28 - Interest Code */
  $28_interestCode?: string;
  /** PV1.29 - Transfer to Bad Debt Code */
  $29_transferToBadDebtCode?: string;
  /** PV1.30 - Transfer to Bad Debt Date */
  $30_transferToBadDebtDate?: string;
  /** PV1.31 - Bad Debt Agency Code */
  $31_badDebtAgencyCode?: string;
  /** PV1.32 - Bad Debt Transfer Amount */
  $32_badDebtTransferAmount?: string;
  /** PV1.33 - Bad Debt Recovery Amount */
  $33_badDebtRecoveryAmount?: string;
  /** PV1.34 - Delete Account Indicator */
  $34_deleteAccountIndicator?: string;
  /** PV1.35 - Delete Account Date */
  $35_deleteAccountDate?: string;
  /** PV1.36 - Discharge Disposition */
  $36_dischargeDisposition?: string;
  /** PV1.37 - Discharged to Location */
  $37_dischargedToLocation?: DLD;
  /** PV1.38 - Diet Type */
  $38_dietType?: CE;
  /** PV1.39 - Servicing Facility */
  $39_servicingFacility?: string;
  /** PV1.40 - Bed Status */
  $40_bedStatus?: BedStatus | string;
  /** PV1.41 - Account Status */
  $41_accountStatus?: string;
  /** PV1.42 - Pending Location */
  $42_pendingLocation?: PL;
  /** PV1.43 - Prior Temporary Location */
  $43_priorTemporaryLocation?: PL;
  /** PV1.44 - Admit Date/Time */
  $44_admission?: string;
  /** PV1.45 - Discharge Date/Time */
  $45_discharge?: string[];
  /** PV1.46 - Current Patient Balance */
  $46_currentPatientBalance?: string;
  /** PV1.47 - Total Charges */
  $47_totalCharges?: string;
  /** PV1.48 - Total Adjustments */
  $48_totalAdjustments?: string;
  /** PV1.49 - Total Payments */
  $49_totalPayments?: string;
  /** PV1.50 - Alternate Visit ID */
  $50_alternateVisitId?: CX;
  /** PV1.51 - Visit Indicator */
  $51_visitIndicator?: VisitIndicator | string;
  /** PV1.52 - Other Healthcare Provider */
  $52_otherHealthcareProvider?: XCN[];
}

/** PV2 Segment */
export interface PV2 {
  /** PV2.1 - Prior Pending Location */
  $1_priorPendingLocation?: PL;
  /** PV2.2 - Accommodation Code */
  $2_accommodationCode?: CE;
  /** PV2.3 - Admit Reason */
  $3_admitReason?: CE;
  /** PV2.4 - Transfer Reason */
  $4_transferReason?: CE;
  /** PV2.5 - Patient Valuables */
  $5_valuables?: string[];
  /** PV2.6 - Patient Valuables Location */
  $6_valuablesLocation?: string;
  /** PV2.7 - Visit User Code */
  $7_visitUserCode?: (VisitUserCodes | string)[];
  /** PV2.8 - Expected Admit Date/Time */
  $8_expectedAdmission?: string;
  /** PV2.9 - Expected Discharge Date/Time */
  $9_expectedDischarge?: string;
  /** PV2.10 - Estimated Length of Inpatient Stay */
  $10_estimatedLengthOfInpatientStay?: string;
  /** PV2.11 - Actual Length of Inpatient Stay */
  $11_actualLengthOfInpatientStay?: string;
  /** PV2.12 - Visit Description */
  $12_visitDescription?: string;
  /** PV2.13 - Referral Source Code */
  $13_referralSourceCode?: XCN[];
  /** PV2.14 - Previous Service Date */
  $14_previousServiceDate?: string;
  /** PV2.15 - Employment Illness Related Indicator */
  $15_employmentIllnessRelatedIndicator?: string;
  /** PV2.16 - Purge Status Code */
  $16_purgeStatusCode?: PurgeStatus | string;
  /** PV2.17 - Purge Status Date */
  $17_purgeStatusDate?: string;
  /** PV2.18 - Special Program Code */
  $18_specialProgramCode?: SpecialProgram | string;
  /** PV2.19 - Retention Indicator */
  $19_retentionIndicator?: string;
  /** PV2.20 - Expected Number of Insurance Plans */
  $20_expectedNumberOfInsurancePlans?: string;
  /** PV2.21 - Visit Publicity Code */
  $21_visitPublicityCode?: Publicity | string;
  /** PV2.22 - Visit Protection Indicator */
  $22_visitProtectionIndicator?: string;
  /** PV2.23 - Clinic Organization Name */
  $23_clinicOrganizationName?: XON[];
  /** PV2.24 - Patient Status Code */
  $24_status?: PatientStatus | string;
  /** PV2.25 - Visit Priority Code */
  $25_visitPriorityCode?: VisitPriority | string;
  /** PV2.26 - Previous Treatment Date */
  $26_previousTreatmentDate?: string;
  /** PV2.27 - Expected Discharge Disposition */
  $27_expectedDischargeDisposition?: string;
  /** PV2.28 - Signature on File Date */
  $28_signatureOnFileDate?: string;
  /** PV2.29 - First Similar Illness Date */
  $29_firstSimilarIllnessDate?: string;
  /** PV2.30 - Patient Charge Adjustment Code */
  $30_chargeAdjustmentCode?: CE;
  /** PV2.31 - Recurring Service Code */
  $31_recurringServiceCode?: string;
  /** PV2.32 - Billing Media Code */
  $32_billingMediaCode?: string;
  /** PV2.33 - Expected Surgery Date and Time */
  $33_expectedSurgeryDateAndTime?: string;
  /** PV2.34 - Military Partnership Code */
  $34_militaryPartnershipCode?: string;
  /** PV2.35 - Military Non-Availability Code */
  $35_militaryNonAvailabilityCode?: string;
  /** PV2.36 - Newborn Baby Indicator */
  $36_newbornBabyIndicator?: string;
  /** PV2.37 - Baby Detained Indicator */
  $37_babyDetainedIndicator?: string;
  /** PV2.38 - Mode of Arrival Code */
  $38_modeOfArrivalCode?: CE;
  /** PV2.39 - Recreational Drug Use Code */
  $39_recreationalDrugUseCode?: CE[];
  /** PV2.40 - Admission Level of Care Code */
  $40_admissionLevelOfCareCode?: CE;
  /** PV2.41 - Precaution Code */
  $41_precautionCode?: CE[];
  /** PV2.42 - Patient Condition Code */
  $42_conditionCode?: CE;
  /** PV2.43 - Living Will Code */
  $43_livingWill?: LivingWillCodes | string;
  /** PV2.44 - Organ Donor Code */
  $44_organDonorCode?: OrganDonorCodes | string;
  /** PV2.45 - Advance Directive Code */
  $45_advanceDirectiveCode?: CE[];
  /** PV2.46 - Patient Status Effective Date */
  $46_statusStart?: string;
  /** PV2.47 - Expected LOA Return Date/Time */
  $47_expectedLoaReturnDateTime?: string;
  /** PV2.48 - Expected Pre-admission Testing Date/Time */
  $48_expectedPreAdmissionTestingDateTime?: string;
  /** PV2.49 - Notify Clergy Code */
  $49_notifyClergyCode?: (ClergyNotificationType | string)[];
}

/** ROL Segment */
export interface ROL {
  /** ROL.1 - Role Instance ID */
  $1_roleInstanceId?: EI;
  /** ROL.2 - Action Code */
  $2_actionCode: ProblemGoalAction | string;
  /** ROL.3 - Role-ROL */
  $3_roleRol: CE;
  /** ROL.4 - Role Person */
  $4_rolePerson: XCN[];
  /** ROL.5 - Role Begin Date/Time */
  $5_roleBeginDateTime?: string;
  /** ROL.6 - Role End Date/Time */
  $6_roleEndDateTime?: string;
  /** ROL.7 - Role Duration */
  $7_roleDuration?: CE;
  /** ROL.8 - Role Action Reason */
  $8_roleActionReason?: CE;
  /** ROL.9 - Provider Type */
  $9_providerType?: CE[];
  /** ROL.10 - Organization Unit Type */
  $10_organizationUnitType?: CE;
  /** ROL.11 - Office/Home Address/Birthplace */
  $11_address?: XAD[];
  /** ROL.12 - Phone */
  $12_phone?: XTN[];
}

/** SFT Segment */
export interface SFT {
  /** SFT.1 - Software Vendor Organization */
  $1_softwareVendorOrganization: XON;
  /** SFT.2 - Software Certified Version or Release Number */
  $2_softwareCertifiedVersionOrReleaseNumber: string;
  /** SFT.3 - Software Product Name */
  $3_softwareProductName: string;
  /** SFT.4 - Software Binary ID */
  $4_softwareBinaryId: string;
  /** SFT.5 - Software Product Information */
  $5_softwareProductInformation?: string;
  /** SFT.6 - Software Install Date */
  $6_softwareInstallDate?: string;
}

/** SPM Segment */
export interface SPM {
  /** SPM.1 - Set ID - SPM */
  $1_setIdSpm?: string;
  /** SPM.2 - Specimen ID */
  $2_specimenId?: EIP;
  /** SPM.3 - Specimen Parent IDs */
  $3_specimenParentIds?: EIP[];
  /** SPM.4 - Specimen Type */
  $4_specimenType: CWE;
  /** SPM.5 - Specimen Type Modifier */
  $5_specimenTypeModifier?: CWE[];
  /** SPM.6 - Specimen Additives */
  $6_specimenAdditives?: CWE[];
  /** SPM.7 - Specimen Collection Method */
  $7_collectionMethod?: CWE;
  /** SPM.8 - Specimen Source Site */
  $8_specimenSourceSite?: CWE;
  /** SPM.9 - Specimen Source Site Modifier */
  $9_specimenSourceSiteModifier?: CWE[];
  /** SPM.10 - Specimen Collection Site */
  $10_specimenCollectionSite?: CWE;
  /** SPM.11 - Specimen Role */
  $11_role?: CWE[];
  /** SPM.12 - Specimen Collection Amount */
  $12_specimenCollectionAmount?: CQ;
  /** SPM.13 - Grouped Specimen Count */
  $13_groupedSpecimenCount?: string;
  /** SPM.14 - Specimen Description */
  $14_specimenDescription?: string[];
  /** SPM.15 - Specimen Handling Code */
  $15_specimenHandlingCode?: CWE[];
  /** SPM.16 - Specimen Risk Code */
  $16_specimenRiskCode?: CWE[];
  /** SPM.17 - Specimen Collection Date/Time */
  $17_specimenCollection?: DR;
  /** SPM.18 - Specimen Received Date/Time */
  $18_specimenReceived?: string;
  /** SPM.19 - Specimen Expiration Date/Time */
  $19_specimenExpiration?: string;
  /** SPM.20 - Specimen Availability */
  $20_specimenAvailability?: string;
  /** SPM.21 - Specimen Reject Reason */
  $21_specimenRejectReason?: CWE[];
  /** SPM.22 - Specimen Quality */
  $22_specimenQuality?: CWE;
  /** SPM.23 - Specimen Appropriateness */
  $23_specimenAppropriateness?: CWE;
  /** SPM.24 - Specimen Condition */
  $24_specimenCondition?: CWE[];
  /** SPM.25 - Specimen Current Quantity */
  $25_specimenCurrentQuantity?: CQ;
  /** SPM.26 - Number of Specimen Containers */
  $26_numberOfSpecimenContainers?: string;
  /** SPM.27 - Container Type */
  $27_containerType?: CWE;
  /** SPM.28 - Container Condition */
  $28_containerCondition?: CWE;
  /** SPM.29 - Specimen Child Role */
  $29_specimenChildRole?: CWE;
}

/** TQ1 Segment */
export interface TQ1 {
  /** TQ1.1 - Set ID - TQ1 */
  $1_setIdTq1?: string;
  /** TQ1.2 - Quantity */
  $2_value?: CQ;
  /** TQ1.3 - Repeat Pattern */
  $3_pattern?: RPT[];
  /** TQ1.4 - Explicit Time */
  $4_explicitTime?: string[];
  /** TQ1.5 - Relative Time and Units */
  $5_relativeTimeAndUnit?: CQ[];
  /** TQ1.6 - Service Duration */
  $6_serviceDuration?: CQ;
  /** TQ1.7 - Start date/time */
  $7_start?: string;
  /** TQ1.8 - End date/time */
  $8_end?: string;
  /** TQ1.9 - Priority */
  $9_priority?: CWE[];
  /** TQ1.10 - Condition text */
  $10_conditionText?: string;
  /** TQ1.11 - Text instruction */
  $11_textInstruction?: string;
  /** TQ1.12 - Conjunction */
  $12_conjunction?: RiskManagementIncident | string;
  /** TQ1.13 - Occurrence duration */
  $13_occurrenceDuration?: CQ;
  /** TQ1.14 - Total occurrence's */
  $14_totalOccurrences?: string;
}

/** TQ2 Segment */
export interface TQ2 {
  /** TQ2.1 - Set ID - TQ2 */
  $1_setIdTq2?: string;
  /** TQ2.2 - Sequence/Results Flag */
  $2_flag?: SequenceResultsFlag | string;
  /** TQ2.3 - Related Placer Number */
  $3_relatedPlacerNumber?: EI[];
  /** TQ2.4 - Related Filler Number */
  $4_relatedFillerNumber?: EI[];
  /** TQ2.5 - Related Placer Group Number */
  $5_relatedPlacerGroupNumber?: EI[];
  /** TQ2.6 - Sequence Condition Code */
  $6_sequenceConditionCode?: SequenceCondition | string;
  /** TQ2.7 - Cyclic Entry/Exit Indicator */
  $7_cyclicEntryExitIndicator?: CyclicEntryExitIndicator | string;
  /** TQ2.8 - Sequence Condition Time Interval */
  $8_sequenceConditionTimeInterval?: CQ;
  /** TQ2.9 - Cyclic Group Maximum Number of Repeats */
  $9_cyclicGroupMaximumNumberOfRepeats?: string;
  /** TQ2.10 - Special Service Request Relationship */
  $10_specialServiceRequestRelationship?: ServiceRequestRelationship | string;
}

/** UB1 Segment */
export interface UB1 {
  /** UB1.1 - Set ID - UB1 */
  $1_setIdUb1?: string;
  /** UB1.2 - Blood Deductible  (43) */
  $2_bloodDeductible?: string;
  /** UB1.3 - Blood Furnished-Pints Of (40) */
  $3_bloodFurnishedPintsOf?: string;
  /** UB1.4 - Blood Replaced-Pints (41) */
  $4_bloodReplacedPints?: string;
  /** UB1.5 - Blood Not Replaced-Pints(42) */
  $5_bloodNotReplacedPints?: string;
  /** UB1.6 - Co-Insurance Days (25) */
  $6_coInsuranceDays?: string;
  /** UB1.7 - Condition Code (35-39) */
  $7_conditionCode?: string[];
  /** UB1.8 - Covered Days - (23) */
  $8_coveredDays?: string;
  /** UB1.9 - Non Covered Days - (24) */
  $9_nonCoveredDays?: string;
  /** UB1.10 - Value Amount & Code (46-49) */
  $10_valueAmountAndCode?: UVC[];
  /** UB1.11 - Number Of Grace Days (90) */
  $11_numberOfGraceDays?: string;
  /** UB1.12 - Special Program Indicator (44) */
  $12_specialProgramIndicator?: CE;
  /** UB1.13 - PSRO/UR Approval Indicator (87) */
  $13_psroUrApprovalIndicator?: CE;
  /** UB1.14 - PSRO/UR Approved Stay-Fm (88) */
  $14_psroUrApprovedStayFm?: string;
  /** UB1.15 - PSRO/UR Approved Stay-To (89) */
  $15_psroUrApprovedStayTo?: string;
  /** UB1.16 - Occurrence (28-32) */
  $16_occurrence?: OCD[];
  /** UB1.17 - Occurrence Span (33) */
  $17_occurrenceSpan?: CE;
  /** UB1.18 - Occur Span Start Date(33) */
  $18_occurSpanStartDate?: string;
  /** UB1.19 - Occur Span End Date (33) */
  $19_occurSpanEndDate?: string;
  /** UB1.20 - UB-82 Locator 2 */
  $20_ub82Locator2?: string;
  /** UB1.21 - UB-82 Locator 9 */
  $21_ub82Locator9?: string;
  /** UB1.22 - UB-82 Locator 27 */
  $22_ub82Locator27?: string;
  /** UB1.23 - UB-82 Locator 45 */
  $23_ub82Locator45?: string;
}

/** UB2 Segment */
export interface UB2 {
  /** UB2.1 - Set ID - UB2 */
  $1_setIdUb2?: string;
  /** UB2.2 - Co-Insurance Days (9) */
  $2_coInsuranceDays?: string;
  /** UB2.3 - Condition Code (24-30) */
  $3_conditionCode?: string[];
  /** UB2.4 - Covered Days (7) */
  $4_coveredDays?: string;
  /** UB2.5 - Non-Covered Days (8) */
  $5_nonCoveredDays?: string;
  /** UB2.6 - Value Amount & Code */
  $6_valueAmountAndCode?: UVC[];
  /** UB2.7 - Occurrence Code & Date (32-35) */
  $7_occurrenceCodeAndDate?: OCD[];
  /** UB2.8 - Occurrence Span Code/Dates (36) */
  $8_occurrenceSpanCodeDates?: OSP[];
  /** UB2.9 - UB92 Locator 2 (State) */
  $9_ub92Locator2?: string[];
  /** UB2.10 - UB92 Locator 11 (State) */
  $10_ub92Locator11?: string[];
  /** UB2.11 - UB92 Locator 31 (National) */
  $11_ub92Locator31?: string;
  /** UB2.12 - Document Control Number */
  $12_documentControlNumber?: string[];
  /** UB2.13 - UB92 Locator 49 (National) */
  $13_ub92Locator49?: string[];
  /** UB2.14 - UB92 Locator 56 (State) */
  $14_ub92Locator56?: string[];
  /** UB2.15 - UB92 Locator 57 (National) */
  $15_ub92Locator57?: string;
  /** UB2.16 - UB92 Locator 78 (State) */
  $16_ub92Locator78?: string[];
  /** UB2.17 - Special Visit Count */
  $17_specialVisitCount?: string;
}

// ====== Segment Conversion ======

/** Convert typed segment object to HL7v2Segment */
export function toSegment<T extends object>(segmentName: string, data: T): HL7v2Segment {
  const fields: Record<number, FieldValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    const match = key.match(/^\$(\d+)_/);
    if (!match || !match[1]) continue;
    const idx = parseInt(match[1], 10);
    if (typeof value === "string") {
      fields[idx] = value;
    } else if (Array.isArray(value)) {
      const arr: FieldValue[] = [];
      for (const v of value) {
        if (typeof v === "string") {
          arr.push(v);
        } else if (v != null) {
          const fv = toFieldValue(v as Record<string, unknown>);
          if (fv !== undefined) arr.push(fv);
        }
      }
      if (arr.length > 0) fields[idx] = arr;
    } else if (typeof value === "object") {
      const fv = toFieldValue(value as Record<string, unknown>);
      if (fv !== undefined) fields[idx] = fv;
    }
  }
  return { segment: segmentName, fields };
}

// ====== FromSegment Converters ======

/** Convert HL7v2Segment to ACC */
export function fromACC(segment: HL7v2Segment): ACC {
  const result: ACC = {} as ACC;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_accidentDateTime = v;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromCE(segment.fields[2]);
    if (converted) result.$2_accidentCode = converted;
  }
  if (segment.fields[3] !== undefined) {
    const v = getComponent(segment.fields[3]);
    if (v !== undefined) result.$3_accidentLocation = v;
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromCE(segment.fields[4]);
    if (converted) result.$4_autoAccidentState = converted;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_accidentJobRelatedIndicator = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_accidentDeathIndicator = v;
  }
  if (segment.fields[7] !== undefined) {
    const converted = fromXCN(segment.fields[7]);
    if (converted) result.$7_enteredBy = converted;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_accidentDescription = v;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_broughtInBy = v;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_policeNotifiedIndicator = v;
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromXAD(segment.fields[11]);
    if (converted) result.$11_accidentAddress = converted;
  }
  return result;
}

/** Convert HL7v2Segment to AL1 */
export function fromAL1(segment: HL7v2Segment): AL1 {
  const result: AL1 = {} as AL1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdAl1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromCE(segment.fields[2]);
    if (converted) result.$2_allergenTypeCode = converted;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromCE(segment.fields[3]);
    if (converted) result.$3_allergenCodeMnemonicDescription = converted;
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromCE(segment.fields[4]);
    if (converted) result.$4_allergySeverityCode = converted;
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_allergyReactionCode = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$5_allergyReactionCode = [fv];
    }
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_identificationDate = v;
  }
  return result;
}

/** Convert HL7v2Segment to CTD */
export function fromCTD(segment: HL7v2Segment): CTD {
  const result: CTD = {} as CTD;
  if (segment.fields[1] !== undefined) {
    const fv = segment.fields[1];
    if (Array.isArray(fv)) {
      result.$1_contactRole = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$1_contactRole = [converted];
    }
  }
  if (segment.fields[2] !== undefined) {
    const fv = segment.fields[2];
    if (Array.isArray(fv)) {
      result.$2_contactName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$2_contactName = [converted];
    }
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_contactAddress = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$3_contactAddress = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromPL(segment.fields[4]);
    if (converted) result.$4_contactLocation = converted;
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_contactCommunicationInformation = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$5_contactCommunicationInformation = [converted];
    }
  }
  if (segment.fields[6] !== undefined) {
    const converted = fromCE(segment.fields[6]);
    if (converted) result.$6_contactPreference = converted;
  }
  if (segment.fields[7] !== undefined) {
    const fv = segment.fields[7];
    if (Array.isArray(fv)) {
      result.$7_contactIdentifiers = fv.map(v => fromPLN(v)).filter((v): v is PLN => v !== undefined);
    } else {
      const converted = fromPLN(fv);
      if (converted) result.$7_contactIdentifiers = [converted];
    }
  }
  return result;
}

/** Convert HL7v2Segment to CTI */
export function fromCTI(segment: HL7v2Segment): CTI {
  const result: CTI = {} as CTI;
  if (segment.fields[1] !== undefined) {
    const converted = fromEI(segment.fields[1]);
    if (converted) result.$1_studyId = converted;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromCE(segment.fields[2]);
    if (converted) result.$2_studyPhaseId = converted;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromCE(segment.fields[3]);
    if (converted) result.$3_studyScheduledTimePoint = converted;
  }
  return result;
}

/** Convert HL7v2Segment to DB1 */
export function fromDB1(segment: HL7v2Segment): DB1 {
  const result: DB1 = {} as DB1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdDb1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_disabledPersonCode = v;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_disabledPersonIdentifier = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$3_disabledPersonIdentifier = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_disabledIndicator = v;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_disabilityStartDate = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_disabilityEndDate = v;
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_disabilityReturnToWorkDate = v;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_disabilityUnableToWorkDate = v;
  }
  return result;
}

/** Convert HL7v2Segment to DG1 */
export function fromDG1(segment: HL7v2Segment): DG1 {
  const result: DG1 = {} as DG1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdDg1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_diagnosisCodingMethod = v;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromCE(segment.fields[3]);
    if (converted) result.$3_diagnosisCodeDg1 = converted;
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_diagnosisDescription = v;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_diagnosisDateTime = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_diagnosisType = v;
  }
  if (segment.fields[7] !== undefined) {
    const converted = fromCE(segment.fields[7]);
    if (converted) result.$7_majorDiagnosticCategory = converted;
  }
  if (segment.fields[8] !== undefined) {
    const converted = fromCE(segment.fields[8]);
    if (converted) result.$8_diagnosticRelatedGroup = converted;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_drgApproval = v;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_drgGrouperReviewCode = v;
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromCE(segment.fields[11]);
    if (converted) result.$11_outlierType = converted;
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_outlierDays = v;
  }
  if (segment.fields[13] !== undefined) {
    const converted = fromCP(segment.fields[13]);
    if (converted) result.$13_outlierCost = converted;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_grouperVersionAndType = v;
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_diagnosisPriority = v;
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_diagnosingClinician = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$16_diagnosingClinician = [converted];
    }
  }
  if (segment.fields[17] !== undefined) {
    const v = getComponent(segment.fields[17]);
    if (v !== undefined) result.$17_diagnosisClassification = v;
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_confidentialIndicator = v;
  }
  if (segment.fields[19] !== undefined) {
    const v = getComponent(segment.fields[19]);
    if (v !== undefined) result.$19_attestationDateTime = v;
  }
  if (segment.fields[20] !== undefined) {
    const converted = fromEI(segment.fields[20]);
    if (converted) result.$20_diagnosisIdentifier = converted;
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_diagnosisActionCode = v;
  }
  return result;
}

/** Convert HL7v2Segment to DRG */
export function fromDRG(segment: HL7v2Segment): DRG {
  const result: DRG = {} as DRG;
  if (segment.fields[1] !== undefined) {
    const converted = fromCE(segment.fields[1]);
    if (converted) result.$1_diagnosticRelatedGroup = converted;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_drgAssignedDateTime = v;
  }
  if (segment.fields[3] !== undefined) {
    const v = getComponent(segment.fields[3]);
    if (v !== undefined) result.$3_drgApproval = v;
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_drgGrouperReviewCode = v;
  }
  if (segment.fields[5] !== undefined) {
    const converted = fromCE(segment.fields[5]);
    if (converted) result.$5_outlierType = converted;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_outlierDays = v;
  }
  if (segment.fields[7] !== undefined) {
    const converted = fromCP(segment.fields[7]);
    if (converted) result.$7_outlierCost = converted;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_drgPayor = v;
  }
  if (segment.fields[9] !== undefined) {
    const converted = fromCP(segment.fields[9]);
    if (converted) result.$9_outlierReimbursement = converted;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_confidentialIndicator = v;
  }
  if (segment.fields[11] !== undefined) {
    const v = getComponent(segment.fields[11]);
    if (v !== undefined) result.$11_drgTransferType = v;
  }
  return result;
}

/** Convert HL7v2Segment to DSC */
export function fromDSC(segment: HL7v2Segment): DSC {
  const result: DSC = {} as DSC;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_continuationPointer = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_continuationStyle = v;
  }
  return result;
}

/** Convert HL7v2Segment to EVN */
export function fromEVN(segment: HL7v2Segment): EVN {
  const result: EVN = {} as EVN;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_eventTypeCode = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_recordedDateTime = v;
  }
  if (segment.fields[3] !== undefined) {
    const v = getComponent(segment.fields[3]);
    if (v !== undefined) result.$3_plannedEventDateTime = v;
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_eventReasonCode = v;
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_operatorId = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$5_operatorId = [converted];
    }
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_eventOccurred = v;
  }
  if (segment.fields[7] !== undefined) {
    const converted = fromHD(segment.fields[7]);
    if (converted) result.$7_eventFacility = converted;
  }
  return result;
}

/** Convert HL7v2Segment to FT1 */
export function fromFT1(segment: HL7v2Segment): FT1 {
  const result: FT1 = {} as FT1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdFt1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_transactionId = v;
  }
  if (segment.fields[3] !== undefined) {
    const v = getComponent(segment.fields[3]);
    if (v !== undefined) result.$3_transactionBatchId = v;
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromDR(segment.fields[4]);
    if (converted) result.$4_transactionDate = converted;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_transactionPostingDate = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_transactionType = v;
  }
  if (segment.fields[7] !== undefined) {
    const converted = fromCE(segment.fields[7]);
    if (converted) result.$7_transactionCode = converted;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_transactionDescription = v;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_transactionDescriptionAlt = v;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_transactionQuantity = v;
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromCP(segment.fields[11]);
    if (converted) result.$11_transactionAmountExtended = converted;
  }
  if (segment.fields[12] !== undefined) {
    const converted = fromCP(segment.fields[12]);
    if (converted) result.$12_transactionAmountUnit = converted;
  }
  if (segment.fields[13] !== undefined) {
    const converted = fromCE(segment.fields[13]);
    if (converted) result.$13_departmentCode = converted;
  }
  if (segment.fields[14] !== undefined) {
    const converted = fromCE(segment.fields[14]);
    if (converted) result.$14_insurancePlanId = converted;
  }
  if (segment.fields[15] !== undefined) {
    const converted = fromCP(segment.fields[15]);
    if (converted) result.$15_insuranceAmount = converted;
  }
  if (segment.fields[16] !== undefined) {
    const converted = fromPL(segment.fields[16]);
    if (converted) result.$16_assignedPatientLocation = converted;
  }
  if (segment.fields[17] !== undefined) {
    const v = getComponent(segment.fields[17]);
    if (v !== undefined) result.$17_feeSchedule = v;
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_type = v;
  }
  if (segment.fields[19] !== undefined) {
    const fv = segment.fields[19];
    if (Array.isArray(fv)) {
      result.$19_diagnosisCodeFt1 = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$19_diagnosisCodeFt1 = [converted];
    }
  }
  if (segment.fields[20] !== undefined) {
    const fv = segment.fields[20];
    if (Array.isArray(fv)) {
      result.$20_performedByCode = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$20_performedByCode = [converted];
    }
  }
  if (segment.fields[21] !== undefined) {
    const fv = segment.fields[21];
    if (Array.isArray(fv)) {
      result.$21_orderedByCode = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$21_orderedByCode = [converted];
    }
  }
  if (segment.fields[22] !== undefined) {
    const converted = fromCP(segment.fields[22]);
    if (converted) result.$22_unitCost = converted;
  }
  if (segment.fields[23] !== undefined) {
    const converted = fromEI(segment.fields[23]);
    if (converted) result.$23_fillerOrderNumber = converted;
  }
  if (segment.fields[24] !== undefined) {
    const fv = segment.fields[24];
    if (Array.isArray(fv)) {
      result.$24_enteredByCode = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$24_enteredByCode = [converted];
    }
  }
  if (segment.fields[25] !== undefined) {
    const converted = fromCE(segment.fields[25]);
    if (converted) result.$25_procedureCode = converted;
  }
  if (segment.fields[26] !== undefined) {
    const fv = segment.fields[26];
    if (Array.isArray(fv)) {
      result.$26_procedureCodeModifier = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$26_procedureCodeModifier = [converted];
    }
  }
  if (segment.fields[27] !== undefined) {
    const converted = fromCE(segment.fields[27]);
    if (converted) result.$27_advancedBeneficiaryNoticeCode = converted;
  }
  if (segment.fields[28] !== undefined) {
    const converted = fromCWE(segment.fields[28]);
    if (converted) result.$28_medicallyNecessaryDuplicateProcedureReason = converted;
  }
  if (segment.fields[29] !== undefined) {
    const converted = fromCNE(segment.fields[29]);
    if (converted) result.$29_ndcCode = converted;
  }
  if (segment.fields[30] !== undefined) {
    const converted = fromCX(segment.fields[30]);
    if (converted) result.$30_paymentReferenceId = converted;
  }
  if (segment.fields[31] !== undefined) {
    const fv = segment.fields[31];
    if (Array.isArray(fv)) {
      result.$31_transactionReferenceKey = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$31_transactionReferenceKey = [fv];
    }
  }
  return result;
}

/** Convert HL7v2Segment to GT1 */
export function fromGT1(segment: HL7v2Segment): GT1 {
  const result: GT1 = {} as GT1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdGt1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const fv = segment.fields[2];
    if (Array.isArray(fv)) {
      result.$2_guarantorNumber = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$2_guarantorNumber = [converted];
    }
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_guarantorName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$3_guarantorName = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const fv = segment.fields[4];
    if (Array.isArray(fv)) {
      result.$4_guarantorSpouseName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$4_guarantorSpouseName = [converted];
    }
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_guarantorAddress = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$5_guarantorAddress = [converted];
    }
  }
  if (segment.fields[6] !== undefined) {
    const fv = segment.fields[6];
    if (Array.isArray(fv)) {
      result.$6_guarantorPhNumHome = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$6_guarantorPhNumHome = [converted];
    }
  }
  if (segment.fields[7] !== undefined) {
    const fv = segment.fields[7];
    if (Array.isArray(fv)) {
      result.$7_guarantorPhNumBusiness = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$7_guarantorPhNumBusiness = [converted];
    }
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_birthDate = v;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_guarantorAdministrativeGender = v;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_guarantorType = v;
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromCE(segment.fields[11]);
    if (converted) result.$11_guarantorRelationship = converted;
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_guarantorSsn = v;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_guarantorDateBegin = v;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_guarantorDateEnd = v;
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_guarantorPriority = v;
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_guarantorEmployerName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$16_guarantorEmployerName = [converted];
    }
  }
  if (segment.fields[17] !== undefined) {
    const fv = segment.fields[17];
    if (Array.isArray(fv)) {
      result.$17_guarantorEmployerAddress = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$17_guarantorEmployerAddress = [converted];
    }
  }
  if (segment.fields[18] !== undefined) {
    const fv = segment.fields[18];
    if (Array.isArray(fv)) {
      result.$18_guarantorEmployerPhoneNumber = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$18_guarantorEmployerPhoneNumber = [converted];
    }
  }
  if (segment.fields[19] !== undefined) {
    const fv = segment.fields[19];
    if (Array.isArray(fv)) {
      result.$19_guarantorEmployeeIdNumber = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$19_guarantorEmployeeIdNumber = [converted];
    }
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_guarantorEmploymentStatus = v;
  }
  if (segment.fields[21] !== undefined) {
    const fv = segment.fields[21];
    if (Array.isArray(fv)) {
      result.$21_guarantorOrganizationName = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$21_guarantorOrganizationName = [converted];
    }
  }
  if (segment.fields[22] !== undefined) {
    const v = getComponent(segment.fields[22]);
    if (v !== undefined) result.$22_guarantorBillingHoldFlag = v;
  }
  if (segment.fields[23] !== undefined) {
    const converted = fromCE(segment.fields[23]);
    if (converted) result.$23_guarantorCreditRatingCode = converted;
  }
  if (segment.fields[24] !== undefined) {
    const v = getComponent(segment.fields[24]);
    if (v !== undefined) result.$24_guarantorDeathDateAndTime = v;
  }
  if (segment.fields[25] !== undefined) {
    const v = getComponent(segment.fields[25]);
    if (v !== undefined) result.$25_guarantorDeathFlag = v;
  }
  if (segment.fields[26] !== undefined) {
    const converted = fromCE(segment.fields[26]);
    if (converted) result.$26_guarantorChargeAdjustmentCode = converted;
  }
  if (segment.fields[27] !== undefined) {
    const converted = fromCP(segment.fields[27]);
    if (converted) result.$27_guarantorHouseholdAnnualIncome = converted;
  }
  if (segment.fields[28] !== undefined) {
    const v = getComponent(segment.fields[28]);
    if (v !== undefined) result.$28_guarantorHouseholdSize = v;
  }
  if (segment.fields[29] !== undefined) {
    const fv = segment.fields[29];
    if (Array.isArray(fv)) {
      result.$29_guarantorEmployerIdNumber = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$29_guarantorEmployerIdNumber = [converted];
    }
  }
  if (segment.fields[30] !== undefined) {
    const converted = fromCE(segment.fields[30]);
    if (converted) result.$30_guarantorMaritalStatusCode = converted;
  }
  if (segment.fields[31] !== undefined) {
    const v = getComponent(segment.fields[31]);
    if (v !== undefined) result.$31_guarantorHireEffectiveDate = v;
  }
  if (segment.fields[32] !== undefined) {
    const v = getComponent(segment.fields[32]);
    if (v !== undefined) result.$32_employmentEnd = v;
  }
  if (segment.fields[33] !== undefined) {
    const v = getComponent(segment.fields[33]);
    if (v !== undefined) result.$33_livingDependency = v;
  }
  if (segment.fields[34] !== undefined) {
    const fv = segment.fields[34];
    if (Array.isArray(fv)) {
      result.$34_ambulatoryStatus = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$34_ambulatoryStatus = [fv];
    }
  }
  if (segment.fields[35] !== undefined) {
    const fv = segment.fields[35];
    if (Array.isArray(fv)) {
      result.$35_citizenship = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$35_citizenship = [converted];
    }
  }
  if (segment.fields[36] !== undefined) {
    const converted = fromCE(segment.fields[36]);
    if (converted) result.$36_language = converted;
  }
  if (segment.fields[37] !== undefined) {
    const v = getComponent(segment.fields[37]);
    if (v !== undefined) result.$37_livingArrangement = v;
  }
  if (segment.fields[38] !== undefined) {
    const converted = fromCE(segment.fields[38]);
    if (converted) result.$38_publicityCode = converted;
  }
  if (segment.fields[39] !== undefined) {
    const v = getComponent(segment.fields[39]);
    if (v !== undefined) result.$39_protectionIndicator = v;
  }
  if (segment.fields[40] !== undefined) {
    const v = getComponent(segment.fields[40]);
    if (v !== undefined) result.$40_student = v;
  }
  if (segment.fields[41] !== undefined) {
    const converted = fromCE(segment.fields[41]);
    if (converted) result.$41_religion = converted;
  }
  if (segment.fields[42] !== undefined) {
    const fv = segment.fields[42];
    if (Array.isArray(fv)) {
      result.$42_mothersMaidenName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$42_mothersMaidenName = [converted];
    }
  }
  if (segment.fields[43] !== undefined) {
    const converted = fromCE(segment.fields[43]);
    if (converted) result.$43_nationality = converted;
  }
  if (segment.fields[44] !== undefined) {
    const fv = segment.fields[44];
    if (Array.isArray(fv)) {
      result.$44_ethnicity = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$44_ethnicity = [converted];
    }
  }
  if (segment.fields[45] !== undefined) {
    const fv = segment.fields[45];
    if (Array.isArray(fv)) {
      result.$45_contactPersonsName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$45_contactPersonsName = [converted];
    }
  }
  if (segment.fields[46] !== undefined) {
    const fv = segment.fields[46];
    if (Array.isArray(fv)) {
      result.$46_contactPhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$46_contactPhone = [converted];
    }
  }
  if (segment.fields[47] !== undefined) {
    const converted = fromCE(segment.fields[47]);
    if (converted) result.$47_contactReason = converted;
  }
  if (segment.fields[48] !== undefined) {
    const v = getComponent(segment.fields[48]);
    if (v !== undefined) result.$48_contactRelationship = v;
  }
  if (segment.fields[49] !== undefined) {
    const v = getComponent(segment.fields[49]);
    if (v !== undefined) result.$49_jobTitle = v;
  }
  if (segment.fields[50] !== undefined) {
    const converted = fromJCC(segment.fields[50]);
    if (converted) result.$50_jobCodeClass = converted;
  }
  if (segment.fields[51] !== undefined) {
    const fv = segment.fields[51];
    if (Array.isArray(fv)) {
      result.$51_guarantorEmployersOrganizationName = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$51_guarantorEmployersOrganizationName = [converted];
    }
  }
  if (segment.fields[52] !== undefined) {
    const v = getComponent(segment.fields[52]);
    if (v !== undefined) result.$52_disability = v;
  }
  if (segment.fields[53] !== undefined) {
    const v = getComponent(segment.fields[53]);
    if (v !== undefined) result.$53_jobStatus = v;
  }
  if (segment.fields[54] !== undefined) {
    const converted = fromFC(segment.fields[54]);
    if (converted) result.$54_guarantorFinancialClass = converted;
  }
  if (segment.fields[55] !== undefined) {
    const fv = segment.fields[55];
    if (Array.isArray(fv)) {
      result.$55_guarantorRace = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$55_guarantorRace = [converted];
    }
  }
  if (segment.fields[56] !== undefined) {
    const v = getComponent(segment.fields[56]);
    if (v !== undefined) result.$56_guarantorBirthPlace = v;
  }
  if (segment.fields[57] !== undefined) {
    const v = getComponent(segment.fields[57]);
    if (v !== undefined) result.$57_vip = v;
  }
  return result;
}

/** Convert HL7v2Segment to IN1 */
export function fromIN1(segment: HL7v2Segment): IN1 {
  const result: IN1 = {} as IN1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdIn1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromCE(segment.fields[2]);
    if (converted) result.$2_insurancePlanId = converted;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_insuranceCompanyId = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$3_insuranceCompanyId = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const fv = segment.fields[4];
    if (Array.isArray(fv)) {
      result.$4_insuranceCompanyName = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$4_insuranceCompanyName = [converted];
    }
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_insuranceCompanyAddress = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$5_insuranceCompanyAddress = [converted];
    }
  }
  if (segment.fields[6] !== undefined) {
    const fv = segment.fields[6];
    if (Array.isArray(fv)) {
      result.$6_insuranceCoContactPerson = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$6_insuranceCoContactPerson = [converted];
    }
  }
  if (segment.fields[7] !== undefined) {
    const fv = segment.fields[7];
    if (Array.isArray(fv)) {
      result.$7_insurancePhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$7_insurancePhone = [converted];
    }
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_groupNumber = v;
  }
  if (segment.fields[9] !== undefined) {
    const fv = segment.fields[9];
    if (Array.isArray(fv)) {
      result.$9_groupName = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$9_groupName = [converted];
    }
  }
  if (segment.fields[10] !== undefined) {
    const fv = segment.fields[10];
    if (Array.isArray(fv)) {
      result.$10_insuredsGroupEmpId = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$10_insuredsGroupEmpId = [converted];
    }
  }
  if (segment.fields[11] !== undefined) {
    const fv = segment.fields[11];
    if (Array.isArray(fv)) {
      result.$11_insuredsGroupEmpName = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$11_insuredsGroupEmpName = [converted];
    }
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_planEffectiveDate = v;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_planExpirationDate = v;
  }
  if (segment.fields[14] !== undefined) {
    const converted = fromAUI(segment.fields[14]);
    if (converted) result.$14_authorizationInformation = converted;
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_planType = v;
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_nameOfInsured = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$16_nameOfInsured = [converted];
    }
  }
  if (segment.fields[17] !== undefined) {
    const converted = fromCE(segment.fields[17]);
    if (converted) result.$17_insuredsRelationshipToPatient = converted;
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_insuredsDateOfBirth = v;
  }
  if (segment.fields[19] !== undefined) {
    const fv = segment.fields[19];
    if (Array.isArray(fv)) {
      result.$19_insuredsAddress = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$19_insuredsAddress = [converted];
    }
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_assignmentOfBenefits = v;
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_coordinationOfBenefits = v;
  }
  if (segment.fields[22] !== undefined) {
    const v = getComponent(segment.fields[22]);
    if (v !== undefined) result.$22_coordOfBenPriority = v;
  }
  if (segment.fields[23] !== undefined) {
    const v = getComponent(segment.fields[23]);
    if (v !== undefined) result.$23_noticeOfAdmissionFlag = v;
  }
  if (segment.fields[24] !== undefined) {
    const v = getComponent(segment.fields[24]);
    if (v !== undefined) result.$24_noticeOfAdmissionDate = v;
  }
  if (segment.fields[25] !== undefined) {
    const v = getComponent(segment.fields[25]);
    if (v !== undefined) result.$25_reportOfEligibilityFlag = v;
  }
  if (segment.fields[26] !== undefined) {
    const v = getComponent(segment.fields[26]);
    if (v !== undefined) result.$26_reportOfEligibilityDate = v;
  }
  if (segment.fields[27] !== undefined) {
    const v = getComponent(segment.fields[27]);
    if (v !== undefined) result.$27_releaseInformationCode = v;
  }
  if (segment.fields[28] !== undefined) {
    const v = getComponent(segment.fields[28]);
    if (v !== undefined) result.$28_preAdmitCert = v;
  }
  if (segment.fields[29] !== undefined) {
    const v = getComponent(segment.fields[29]);
    if (v !== undefined) result.$29_verificationDateTime = v;
  }
  if (segment.fields[30] !== undefined) {
    const fv = segment.fields[30];
    if (Array.isArray(fv)) {
      result.$30_verificationBy = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$30_verificationBy = [converted];
    }
  }
  if (segment.fields[31] !== undefined) {
    const v = getComponent(segment.fields[31]);
    if (v !== undefined) result.$31_typeOfAgreementCode = v;
  }
  if (segment.fields[32] !== undefined) {
    const v = getComponent(segment.fields[32]);
    if (v !== undefined) result.$32_billingStatus = v;
  }
  if (segment.fields[33] !== undefined) {
    const v = getComponent(segment.fields[33]);
    if (v !== undefined) result.$33_lifetimeReserveDays = v;
  }
  if (segment.fields[34] !== undefined) {
    const v = getComponent(segment.fields[34]);
    if (v !== undefined) result.$34_delayBeforeLRDay = v;
  }
  if (segment.fields[35] !== undefined) {
    const v = getComponent(segment.fields[35]);
    if (v !== undefined) result.$35_companyPlanCode = v;
  }
  if (segment.fields[36] !== undefined) {
    const v = getComponent(segment.fields[36]);
    if (v !== undefined) result.$36_policyNumber = v;
  }
  if (segment.fields[37] !== undefined) {
    const converted = fromCP(segment.fields[37]);
    if (converted) result.$37_policyDeductible = converted;
  }
  if (segment.fields[38] !== undefined) {
    const converted = fromCP(segment.fields[38]);
    if (converted) result.$38_policyLimitAmount = converted;
  }
  if (segment.fields[39] !== undefined) {
    const v = getComponent(segment.fields[39]);
    if (v !== undefined) result.$39_policyLimitDays = v;
  }
  if (segment.fields[40] !== undefined) {
    const converted = fromCP(segment.fields[40]);
    if (converted) result.$40_roomRateSemiPrivate = converted;
  }
  if (segment.fields[41] !== undefined) {
    const converted = fromCP(segment.fields[41]);
    if (converted) result.$41_roomRatePrivate = converted;
  }
  if (segment.fields[42] !== undefined) {
    const converted = fromCE(segment.fields[42]);
    if (converted) result.$42_insuredsEmploymentStatus = converted;
  }
  if (segment.fields[43] !== undefined) {
    const v = getComponent(segment.fields[43]);
    if (v !== undefined) result.$43_insuredsAdministrativeGender = v;
  }
  if (segment.fields[44] !== undefined) {
    const fv = segment.fields[44];
    if (Array.isArray(fv)) {
      result.$44_insuredsEmployersAddress = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$44_insuredsEmployersAddress = [converted];
    }
  }
  if (segment.fields[45] !== undefined) {
    const v = getComponent(segment.fields[45]);
    if (v !== undefined) result.$45_verificationStatus = v;
  }
  if (segment.fields[46] !== undefined) {
    const v = getComponent(segment.fields[46]);
    if (v !== undefined) result.$46_priorInsurancePlanId = v;
  }
  if (segment.fields[47] !== undefined) {
    const v = getComponent(segment.fields[47]);
    if (v !== undefined) result.$47_coverageType = v;
  }
  if (segment.fields[48] !== undefined) {
    const v = getComponent(segment.fields[48]);
    if (v !== undefined) result.$48_disability = v;
  }
  if (segment.fields[49] !== undefined) {
    const fv = segment.fields[49];
    if (Array.isArray(fv)) {
      result.$49_insuredsIdNumber = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$49_insuredsIdNumber = [converted];
    }
  }
  if (segment.fields[50] !== undefined) {
    const v = getComponent(segment.fields[50]);
    if (v !== undefined) result.$50_signatureCode = v;
  }
  if (segment.fields[51] !== undefined) {
    const v = getComponent(segment.fields[51]);
    if (v !== undefined) result.$51_signatureCodeDate = v;
  }
  if (segment.fields[52] !== undefined) {
    const v = getComponent(segment.fields[52]);
    if (v !== undefined) result.$52_insuredsBirthPlace = v;
  }
  if (segment.fields[53] !== undefined) {
    const v = getComponent(segment.fields[53]);
    if (v !== undefined) result.$53_vip = v;
  }
  return result;
}

/** Convert HL7v2Segment to IN2 */
export function fromIN2(segment: HL7v2Segment): IN2 {
  const result: IN2 = {} as IN2;
  if (segment.fields[1] !== undefined) {
    const fv = segment.fields[1];
    if (Array.isArray(fv)) {
      result.$1_insuredsEmployeeId = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$1_insuredsEmployeeId = [converted];
    }
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_insuredsSocialSecurityNumber = v;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_insuredsEmployersNameAndId = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$3_insuredsEmployersNameAndId = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_employerInformationData = v;
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_mailClaimParty = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$5_mailClaimParty = [fv];
    }
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_medicareHealthInsCardNumber = v;
  }
  if (segment.fields[7] !== undefined) {
    const fv = segment.fields[7];
    if (Array.isArray(fv)) {
      result.$7_medicaidCaseName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$7_medicaidCaseName = [converted];
    }
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_medicaidCaseNumber = v;
  }
  if (segment.fields[9] !== undefined) {
    const fv = segment.fields[9];
    if (Array.isArray(fv)) {
      result.$9_militarySponsorName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$9_militarySponsorName = [converted];
    }
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_militaryIdNumber = v;
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromCE(segment.fields[11]);
    if (converted) result.$11_dependentOfMilitaryRecipient = converted;
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_militaryOrganization = v;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_militaryStation = v;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_militaryService = v;
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_militaryRankGrade = v;
  }
  if (segment.fields[16] !== undefined) {
    const v = getComponent(segment.fields[16]);
    if (v !== undefined) result.$16_militaryStatus = v;
  }
  if (segment.fields[17] !== undefined) {
    const v = getComponent(segment.fields[17]);
    if (v !== undefined) result.$17_militaryRetireDate = v;
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_militaryNonAvailCertOnFile = v;
  }
  if (segment.fields[19] !== undefined) {
    const v = getComponent(segment.fields[19]);
    if (v !== undefined) result.$19_babyCoverage = v;
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_combineBabyBill = v;
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_bloodDeductible = v;
  }
  if (segment.fields[22] !== undefined) {
    const fv = segment.fields[22];
    if (Array.isArray(fv)) {
      result.$22_specialCoverageApprovalName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$22_specialCoverageApprovalName = [converted];
    }
  }
  if (segment.fields[23] !== undefined) {
    const v = getComponent(segment.fields[23]);
    if (v !== undefined) result.$23_specialCoverageApprovalTitle = v;
  }
  if (segment.fields[24] !== undefined) {
    const fv = segment.fields[24];
    if (Array.isArray(fv)) {
      result.$24_nonCoveredInsuranceCode = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$24_nonCoveredInsuranceCode = [fv];
    }
  }
  if (segment.fields[25] !== undefined) {
    const fv = segment.fields[25];
    if (Array.isArray(fv)) {
      result.$25_payorId = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$25_payorId = [converted];
    }
  }
  if (segment.fields[26] !== undefined) {
    const fv = segment.fields[26];
    if (Array.isArray(fv)) {
      result.$26_payorSubscriberId = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$26_payorSubscriberId = [converted];
    }
  }
  if (segment.fields[27] !== undefined) {
    const v = getComponent(segment.fields[27]);
    if (v !== undefined) result.$27_eligibilitySource = v;
  }
  if (segment.fields[28] !== undefined) {
    const fv = segment.fields[28];
    if (Array.isArray(fv)) {
      result.$28_roomCoverageTypeAmount = fv.map(v => fromRMC(v)).filter((v): v is RMC => v !== undefined);
    } else {
      const converted = fromRMC(fv);
      if (converted) result.$28_roomCoverageTypeAmount = [converted];
    }
  }
  if (segment.fields[29] !== undefined) {
    const fv = segment.fields[29];
    if (Array.isArray(fv)) {
      result.$29_policyTypeAmount = fv.map(v => fromPTA(v)).filter((v): v is PTA => v !== undefined);
    } else {
      const converted = fromPTA(fv);
      if (converted) result.$29_policyTypeAmount = [converted];
    }
  }
  if (segment.fields[30] !== undefined) {
    const converted = fromDDI(segment.fields[30]);
    if (converted) result.$30_dailyDeductible = converted;
  }
  if (segment.fields[31] !== undefined) {
    const v = getComponent(segment.fields[31]);
    if (v !== undefined) result.$31_livingDependency = v;
  }
  if (segment.fields[32] !== undefined) {
    const fv = segment.fields[32];
    if (Array.isArray(fv)) {
      result.$32_ambulatoryStatus = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$32_ambulatoryStatus = [fv];
    }
  }
  if (segment.fields[33] !== undefined) {
    const fv = segment.fields[33];
    if (Array.isArray(fv)) {
      result.$33_citizenship = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$33_citizenship = [converted];
    }
  }
  if (segment.fields[34] !== undefined) {
    const converted = fromCE(segment.fields[34]);
    if (converted) result.$34_language = converted;
  }
  if (segment.fields[35] !== undefined) {
    const v = getComponent(segment.fields[35]);
    if (v !== undefined) result.$35_livingArrangement = v;
  }
  if (segment.fields[36] !== undefined) {
    const converted = fromCE(segment.fields[36]);
    if (converted) result.$36_publicityCode = converted;
  }
  if (segment.fields[37] !== undefined) {
    const v = getComponent(segment.fields[37]);
    if (v !== undefined) result.$37_protectionIndicator = v;
  }
  if (segment.fields[38] !== undefined) {
    const v = getComponent(segment.fields[38]);
    if (v !== undefined) result.$38_student = v;
  }
  if (segment.fields[39] !== undefined) {
    const converted = fromCE(segment.fields[39]);
    if (converted) result.$39_religion = converted;
  }
  if (segment.fields[40] !== undefined) {
    const fv = segment.fields[40];
    if (Array.isArray(fv)) {
      result.$40_mothersMaidenName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$40_mothersMaidenName = [converted];
    }
  }
  if (segment.fields[41] !== undefined) {
    const converted = fromCE(segment.fields[41]);
    if (converted) result.$41_nationality = converted;
  }
  if (segment.fields[42] !== undefined) {
    const fv = segment.fields[42];
    if (Array.isArray(fv)) {
      result.$42_ethnicity = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$42_ethnicity = [converted];
    }
  }
  if (segment.fields[43] !== undefined) {
    const fv = segment.fields[43];
    if (Array.isArray(fv)) {
      result.$43_maritalStatus = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$43_maritalStatus = [converted];
    }
  }
  if (segment.fields[44] !== undefined) {
    const v = getComponent(segment.fields[44]);
    if (v !== undefined) result.$44_insuredsEmploymentStartDate = v;
  }
  if (segment.fields[45] !== undefined) {
    const v = getComponent(segment.fields[45]);
    if (v !== undefined) result.$45_employmentEnd = v;
  }
  if (segment.fields[46] !== undefined) {
    const v = getComponent(segment.fields[46]);
    if (v !== undefined) result.$46_jobTitle = v;
  }
  if (segment.fields[47] !== undefined) {
    const converted = fromJCC(segment.fields[47]);
    if (converted) result.$47_jobCodeClass = converted;
  }
  if (segment.fields[48] !== undefined) {
    const v = getComponent(segment.fields[48]);
    if (v !== undefined) result.$48_jobStatus = v;
  }
  if (segment.fields[49] !== undefined) {
    const fv = segment.fields[49];
    if (Array.isArray(fv)) {
      result.$49_employerContactPersonName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$49_employerContactPersonName = [converted];
    }
  }
  if (segment.fields[50] !== undefined) {
    const fv = segment.fields[50];
    if (Array.isArray(fv)) {
      result.$50_employerContactPhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$50_employerContactPhone = [converted];
    }
  }
  if (segment.fields[51] !== undefined) {
    const v = getComponent(segment.fields[51]);
    if (v !== undefined) result.$51_employerContactReason = v;
  }
  if (segment.fields[52] !== undefined) {
    const fv = segment.fields[52];
    if (Array.isArray(fv)) {
      result.$52_insuredsContactPersonsName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$52_insuredsContactPersonsName = [converted];
    }
  }
  if (segment.fields[53] !== undefined) {
    const fv = segment.fields[53];
    if (Array.isArray(fv)) {
      result.$53_insuredContactPhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$53_insuredContactPhone = [converted];
    }
  }
  if (segment.fields[54] !== undefined) {
    const fv = segment.fields[54];
    if (Array.isArray(fv)) {
      result.$54_insuredsContactPersonReason = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$54_insuredsContactPersonReason = [fv];
    }
  }
  if (segment.fields[55] !== undefined) {
    const v = getComponent(segment.fields[55]);
    if (v !== undefined) result.$55_relationshipToThePatientStartDate = v;
  }
  if (segment.fields[56] !== undefined) {
    const fv = segment.fields[56];
    if (Array.isArray(fv)) {
      result.$56_relationshipToThePatientStopDate = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$56_relationshipToThePatientStopDate = [fv];
    }
  }
  if (segment.fields[57] !== undefined) {
    const v = getComponent(segment.fields[57]);
    if (v !== undefined) result.$57_insuranceCoContactReason = v;
  }
  if (segment.fields[58] !== undefined) {
    const converted = fromXTN(segment.fields[58]);
    if (converted) result.$58_insuranceContactPhone = converted;
  }
  if (segment.fields[59] !== undefined) {
    const v = getComponent(segment.fields[59]);
    if (v !== undefined) result.$59_policyScope = v;
  }
  if (segment.fields[60] !== undefined) {
    const v = getComponent(segment.fields[60]);
    if (v !== undefined) result.$60_policySource = v;
  }
  if (segment.fields[61] !== undefined) {
    const converted = fromCX(segment.fields[61]);
    if (converted) result.$61_memberNumber = converted;
  }
  if (segment.fields[62] !== undefined) {
    const converted = fromCE(segment.fields[62]);
    if (converted) result.$62_guarantorsRelationshipToInsured = converted;
  }
  if (segment.fields[63] !== undefined) {
    const fv = segment.fields[63];
    if (Array.isArray(fv)) {
      result.$63_insuredHomePhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$63_insuredHomePhone = [converted];
    }
  }
  if (segment.fields[64] !== undefined) {
    const fv = segment.fields[64];
    if (Array.isArray(fv)) {
      result.$64_insuredEmployerPhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$64_insuredEmployerPhone = [converted];
    }
  }
  if (segment.fields[65] !== undefined) {
    const converted = fromCE(segment.fields[65]);
    if (converted) result.$65_militaryHandicappedProgram = converted;
  }
  if (segment.fields[66] !== undefined) {
    const v = getComponent(segment.fields[66]);
    if (v !== undefined) result.$66_suspendFlag = v;
  }
  if (segment.fields[67] !== undefined) {
    const v = getComponent(segment.fields[67]);
    if (v !== undefined) result.$67_copayLimitFlag = v;
  }
  if (segment.fields[68] !== undefined) {
    const v = getComponent(segment.fields[68]);
    if (v !== undefined) result.$68_stoplossLimitFlag = v;
  }
  if (segment.fields[69] !== undefined) {
    const fv = segment.fields[69];
    if (Array.isArray(fv)) {
      result.$69_insuredOrganizationNameAndId = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$69_insuredOrganizationNameAndId = [converted];
    }
  }
  if (segment.fields[70] !== undefined) {
    const fv = segment.fields[70];
    if (Array.isArray(fv)) {
      result.$70_insuredEmployerOrganizationNameAndId = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$70_insuredEmployerOrganizationNameAndId = [converted];
    }
  }
  if (segment.fields[71] !== undefined) {
    const fv = segment.fields[71];
    if (Array.isArray(fv)) {
      result.$71_race = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$71_race = [converted];
    }
  }
  if (segment.fields[72] !== undefined) {
    const converted = fromCE(segment.fields[72]);
    if (converted) result.$72_cmsPatientsRelationshipToInsured = converted;
  }
  return result;
}

/** Convert HL7v2Segment to IN3 */
export function fromIN3(segment: HL7v2Segment): IN3 {
  const result: IN3 = {} as IN3;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdIn3 = v;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromCX(segment.fields[2]);
    if (converted) result.$2_certificationNumber = converted;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_certifiedBy = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$3_certifiedBy = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_required = v;
  }
  if (segment.fields[5] !== undefined) {
    const converted = fromMOP(segment.fields[5]);
    if (converted) result.$5_penalty = converted;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_certificationDateTime = v;
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_certificationModifyDateTime = v;
  }
  if (segment.fields[8] !== undefined) {
    const fv = segment.fields[8];
    if (Array.isArray(fv)) {
      result.$8_operator = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$8_operator = [converted];
    }
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_certificationBeginDate = v;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_certificationEndDate = v;
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromDTN(segment.fields[11]);
    if (converted) result.$11_days = converted;
  }
  if (segment.fields[12] !== undefined) {
    const converted = fromCE(segment.fields[12]);
    if (converted) result.$12_nonConcurCodeDescription = converted;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_nonConcurEffectiveDateTime = v;
  }
  if (segment.fields[14] !== undefined) {
    const fv = segment.fields[14];
    if (Array.isArray(fv)) {
      result.$14_physicianReviewer = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$14_physicianReviewer = [converted];
    }
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_certificationContact = v;
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_certificationContactPhoneNumber = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$16_certificationContactPhoneNumber = [converted];
    }
  }
  if (segment.fields[17] !== undefined) {
    const converted = fromCE(segment.fields[17]);
    if (converted) result.$17_appealReason = converted;
  }
  if (segment.fields[18] !== undefined) {
    const converted = fromCE(segment.fields[18]);
    if (converted) result.$18_certificationAgency = converted;
  }
  if (segment.fields[19] !== undefined) {
    const fv = segment.fields[19];
    if (Array.isArray(fv)) {
      result.$19_certificationAgencyPhoneNumber = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$19_certificationAgencyPhoneNumber = [converted];
    }
  }
  if (segment.fields[20] !== undefined) {
    const fv = segment.fields[20];
    if (Array.isArray(fv)) {
      result.$20_preCertificationRequirement = fv.map(v => fromICD(v)).filter((v): v is ICD => v !== undefined);
    } else {
      const converted = fromICD(fv);
      if (converted) result.$20_preCertificationRequirement = [converted];
    }
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_caseManager = v;
  }
  if (segment.fields[22] !== undefined) {
    const v = getComponent(segment.fields[22]);
    if (v !== undefined) result.$22_secondOpinionDate = v;
  }
  if (segment.fields[23] !== undefined) {
    const v = getComponent(segment.fields[23]);
    if (v !== undefined) result.$23_secondOpinionStatus = v;
  }
  if (segment.fields[24] !== undefined) {
    const fv = segment.fields[24];
    if (Array.isArray(fv)) {
      result.$24_secondOpinionDocumentationReceived = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$24_secondOpinionDocumentationReceived = [fv];
    }
  }
  if (segment.fields[25] !== undefined) {
    const fv = segment.fields[25];
    if (Array.isArray(fv)) {
      result.$25_secondOpinionPhysician = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$25_secondOpinionPhysician = [converted];
    }
  }
  return result;
}

/** Convert HL7v2Segment to MSH */
export function fromMSH(segment: HL7v2Segment): MSH {
  const result: MSH = {} as MSH;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_fieldSeparator = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_encodingCharacters = v;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromHD(segment.fields[3]);
    if (converted) result.$3_sendingApplication = converted;
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromHD(segment.fields[4]);
    if (converted) result.$4_sendingFacility = converted;
  }
  if (segment.fields[5] !== undefined) {
    const converted = fromHD(segment.fields[5]);
    if (converted) result.$5_receivingApplication = converted;
  }
  if (segment.fields[6] !== undefined) {
    const converted = fromHD(segment.fields[6]);
    if (converted) result.$6_receivingFacility = converted;
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_messageDateTime = v;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_security = v;
  }
  if (segment.fields[9] !== undefined) {
    const converted = fromMSG(segment.fields[9]);
    if (converted) result.$9_messageType = converted;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_messageControlId = v;
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromPT(segment.fields[11]);
    if (converted) result.$11_processingId = converted;
  }
  if (segment.fields[12] !== undefined) {
    const converted = fromVID(segment.fields[12]);
    if (converted) result.$12_version = converted;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_sequenceNumber = v;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_continuationPointer = v;
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_acceptAcknowledgmentType = v;
  }
  if (segment.fields[16] !== undefined) {
    const v = getComponent(segment.fields[16]);
    if (v !== undefined) result.$16_applicationAcknowledgmentType = v;
  }
  if (segment.fields[17] !== undefined) {
    const v = getComponent(segment.fields[17]);
    if (v !== undefined) result.$17_countryCode = v;
  }
  if (segment.fields[18] !== undefined) {
    const fv = segment.fields[18];
    if (Array.isArray(fv)) {
      result.$18_characterSet = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$18_characterSet = [fv];
    }
  }
  if (segment.fields[19] !== undefined) {
    const converted = fromCE(segment.fields[19]);
    if (converted) result.$19_principalLanguageOfMessage = converted;
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_alternateCharacterSetHandlingScheme = v;
  }
  if (segment.fields[21] !== undefined) {
    const fv = segment.fields[21];
    if (Array.isArray(fv)) {
      result.$21_messageProfileIdentifier = fv.map(v => fromEI(v)).filter((v): v is EI => v !== undefined);
    } else {
      const converted = fromEI(fv);
      if (converted) result.$21_messageProfileIdentifier = [converted];
    }
  }
  return result;
}

/** Convert HL7v2Segment to NK1 */
export function fromNK1(segment: HL7v2Segment): NK1 {
  const result: NK1 = {} as NK1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdNk1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const fv = segment.fields[2];
    if (Array.isArray(fv)) {
      result.$2_name = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$2_name = [converted];
    }
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromCE(segment.fields[3]);
    if (converted) result.$3_relationship = converted;
  }
  if (segment.fields[4] !== undefined) {
    const fv = segment.fields[4];
    if (Array.isArray(fv)) {
      result.$4_text = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$4_text = [converted];
    }
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_phone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$5_phone = [converted];
    }
  }
  if (segment.fields[6] !== undefined) {
    const fv = segment.fields[6];
    if (Array.isArray(fv)) {
      result.$6_businessPhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$6_businessPhone = [converted];
    }
  }
  if (segment.fields[7] !== undefined) {
    const converted = fromCE(segment.fields[7]);
    if (converted) result.$7_contactRole = converted;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_startDate = v;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_endDate = v;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_nextOfKinAssociatedPartiesJobTitle = v;
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromJCC(segment.fields[11]);
    if (converted) result.$11_nextOfKinAssociatedPartiesJobCodeClass = converted;
  }
  if (segment.fields[12] !== undefined) {
    const converted = fromCX(segment.fields[12]);
    if (converted) result.$12_nextOfKinAssociatedPartiesEmployeeNumber = converted;
  }
  if (segment.fields[13] !== undefined) {
    const fv = segment.fields[13];
    if (Array.isArray(fv)) {
      result.$13_organizationNameNk1 = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$13_organizationNameNk1 = [converted];
    }
  }
  if (segment.fields[14] !== undefined) {
    const converted = fromCE(segment.fields[14]);
    if (converted) result.$14_maritalStatus = converted;
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_gender = v;
  }
  if (segment.fields[16] !== undefined) {
    const v = getComponent(segment.fields[16]);
    if (v !== undefined) result.$16_birthDate = v;
  }
  if (segment.fields[17] !== undefined) {
    const fv = segment.fields[17];
    if (Array.isArray(fv)) {
      result.$17_livingDependency = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$17_livingDependency = [fv];
    }
  }
  if (segment.fields[18] !== undefined) {
    const fv = segment.fields[18];
    if (Array.isArray(fv)) {
      result.$18_ambulatoryStatus = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$18_ambulatoryStatus = [fv];
    }
  }
  if (segment.fields[19] !== undefined) {
    const fv = segment.fields[19];
    if (Array.isArray(fv)) {
      result.$19_citizenship = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$19_citizenship = [converted];
    }
  }
  if (segment.fields[20] !== undefined) {
    const converted = fromCE(segment.fields[20]);
    if (converted) result.$20_language = converted;
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_livingArrangement = v;
  }
  if (segment.fields[22] !== undefined) {
    const converted = fromCE(segment.fields[22]);
    if (converted) result.$22_publicityCode = converted;
  }
  if (segment.fields[23] !== undefined) {
    const v = getComponent(segment.fields[23]);
    if (v !== undefined) result.$23_protectionIndicator = v;
  }
  if (segment.fields[24] !== undefined) {
    const v = getComponent(segment.fields[24]);
    if (v !== undefined) result.$24_student = v;
  }
  if (segment.fields[25] !== undefined) {
    const converted = fromCE(segment.fields[25]);
    if (converted) result.$25_religion = converted;
  }
  if (segment.fields[26] !== undefined) {
    const fv = segment.fields[26];
    if (Array.isArray(fv)) {
      result.$26_mothersMaidenName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$26_mothersMaidenName = [converted];
    }
  }
  if (segment.fields[27] !== undefined) {
    const converted = fromCE(segment.fields[27]);
    if (converted) result.$27_nationality = converted;
  }
  if (segment.fields[28] !== undefined) {
    const fv = segment.fields[28];
    if (Array.isArray(fv)) {
      result.$28_ethnicity = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$28_ethnicity = [converted];
    }
  }
  if (segment.fields[29] !== undefined) {
    const fv = segment.fields[29];
    if (Array.isArray(fv)) {
      result.$29_contactReason = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$29_contactReason = [converted];
    }
  }
  if (segment.fields[30] !== undefined) {
    const fv = segment.fields[30];
    if (Array.isArray(fv)) {
      result.$30_contactPersonsName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$30_contactPersonsName = [converted];
    }
  }
  if (segment.fields[31] !== undefined) {
    const fv = segment.fields[31];
    if (Array.isArray(fv)) {
      result.$31_contactPhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$31_contactPhone = [converted];
    }
  }
  if (segment.fields[32] !== undefined) {
    const fv = segment.fields[32];
    if (Array.isArray(fv)) {
      result.$32_contactPersonsAddress = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$32_contactPersonsAddress = [converted];
    }
  }
  if (segment.fields[33] !== undefined) {
    const fv = segment.fields[33];
    if (Array.isArray(fv)) {
      result.$33_nextOfKinAssociatedPartysIdentifiers = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$33_nextOfKinAssociatedPartysIdentifiers = [converted];
    }
  }
  if (segment.fields[34] !== undefined) {
    const v = getComponent(segment.fields[34]);
    if (v !== undefined) result.$34_jobStatus = v;
  }
  if (segment.fields[35] !== undefined) {
    const fv = segment.fields[35];
    if (Array.isArray(fv)) {
      result.$35_race = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$35_race = [converted];
    }
  }
  if (segment.fields[36] !== undefined) {
    const v = getComponent(segment.fields[36]);
    if (v !== undefined) result.$36_disability = v;
  }
  if (segment.fields[37] !== undefined) {
    const v = getComponent(segment.fields[37]);
    if (v !== undefined) result.$37_contactPersonSocialSecurityNumber = v;
  }
  if (segment.fields[38] !== undefined) {
    const v = getComponent(segment.fields[38]);
    if (v !== undefined) result.$38_nextOfKinBirthPlace = v;
  }
  if (segment.fields[39] !== undefined) {
    const v = getComponent(segment.fields[39]);
    if (v !== undefined) result.$39_vip = v;
  }
  return result;
}

/** Convert HL7v2Segment to NTE */
export function fromNTE(segment: HL7v2Segment): NTE {
  const result: NTE = {} as NTE;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdNte = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_sourceOfComment = v;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_comment = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$3_comment = [fv];
    }
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromCE(segment.fields[4]);
    if (converted) result.$4_commentType = converted;
  }
  return result;
}

/** Convert HL7v2Segment to OBR */
export function fromOBR(segment: HL7v2Segment): OBR {
  const result: OBR = {} as OBR;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdObr = v;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromEI(segment.fields[2]);
    if (converted) result.$2_placerOrderNumber = converted;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromEI(segment.fields[3]);
    if (converted) result.$3_fillerOrderNumber = converted;
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromCE(segment.fields[4]);
    if (converted) result.$4_service = converted;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_priorityObr = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_requestedDateTime = v;
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_observationDateTime = v;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_observationEndDateTime = v;
  }
  if (segment.fields[9] !== undefined) {
    const converted = fromCQ(segment.fields[9]);
    if (converted) result.$9_collectionVolume = converted;
  }
  if (segment.fields[10] !== undefined) {
    const fv = segment.fields[10];
    if (Array.isArray(fv)) {
      result.$10_collectorIdentifier = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$10_collectorIdentifier = [converted];
    }
  }
  if (segment.fields[11] !== undefined) {
    const v = getComponent(segment.fields[11]);
    if (v !== undefined) result.$11_specimenActionCode = v;
  }
  if (segment.fields[12] !== undefined) {
    const converted = fromCE(segment.fields[12]);
    if (converted) result.$12_dangerCode = converted;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_relevantClinicalInformation = v;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_specimenReceived = v;
  }
  if (segment.fields[15] !== undefined) {
    const converted = fromSPS(segment.fields[15]);
    if (converted) result.$15_specimenSource = converted;
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_orderingProvider = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$16_orderingProvider = [converted];
    }
  }
  if (segment.fields[17] !== undefined) {
    const fv = segment.fields[17];
    if (Array.isArray(fv)) {
      result.$17_callbackPhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$17_callbackPhone = [converted];
    }
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_placerField1 = v;
  }
  if (segment.fields[19] !== undefined) {
    const v = getComponent(segment.fields[19]);
    if (v !== undefined) result.$19_placerField2 = v;
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_fillerField1 = v;
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_fillerField2 = v;
  }
  if (segment.fields[22] !== undefined) {
    const v = getComponent(segment.fields[22]);
    if (v !== undefined) result.$22_resultsRptStatusChngDateTime = v;
  }
  if (segment.fields[23] !== undefined) {
    const converted = fromMOC(segment.fields[23]);
    if (converted) result.$23_chargeToPractice = converted;
  }
  if (segment.fields[24] !== undefined) {
    const v = getComponent(segment.fields[24]);
    if (v !== undefined) result.$24_diagnosticServSectId = v;
  }
  if (segment.fields[25] !== undefined) {
    const v = getComponent(segment.fields[25]);
    if (v !== undefined) result.$25_resultStatus = v;
  }
  if (segment.fields[26] !== undefined) {
    const converted = fromPRL(segment.fields[26]);
    if (converted) result.$26_parentResult = converted;
  }
  if (segment.fields[27] !== undefined) {
    const fv = segment.fields[27];
    if (Array.isArray(fv)) {
      result.$27_timing = fv.map(v => fromTQ(v)).filter((v): v is TQ => v !== undefined);
    } else {
      const converted = fromTQ(fv);
      if (converted) result.$27_timing = [converted];
    }
  }
  if (segment.fields[28] !== undefined) {
    const fv = segment.fields[28];
    if (Array.isArray(fv)) {
      result.$28_resultCopiesTo = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$28_resultCopiesTo = [converted];
    }
  }
  if (segment.fields[29] !== undefined) {
    const converted = fromEIP(segment.fields[29]);
    if (converted) result.$29_parent = converted;
  }
  if (segment.fields[30] !== undefined) {
    const v = getComponent(segment.fields[30]);
    if (v !== undefined) result.$30_transportationMode = v;
  }
  if (segment.fields[31] !== undefined) {
    const fv = segment.fields[31];
    if (Array.isArray(fv)) {
      result.$31_reasonForStudy = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$31_reasonForStudy = [converted];
    }
  }
  if (segment.fields[32] !== undefined) {
    const converted = fromNDL(segment.fields[32]);
    if (converted) result.$32_principalResultInterpreter = converted;
  }
  if (segment.fields[33] !== undefined) {
    const fv = segment.fields[33];
    if (Array.isArray(fv)) {
      result.$33_assistantResultInterpreter = fv.map(v => fromNDL(v)).filter((v): v is NDL => v !== undefined);
    } else {
      const converted = fromNDL(fv);
      if (converted) result.$33_assistantResultInterpreter = [converted];
    }
  }
  if (segment.fields[34] !== undefined) {
    const fv = segment.fields[34];
    if (Array.isArray(fv)) {
      result.$34_technician = fv.map(v => fromNDL(v)).filter((v): v is NDL => v !== undefined);
    } else {
      const converted = fromNDL(fv);
      if (converted) result.$34_technician = [converted];
    }
  }
  if (segment.fields[35] !== undefined) {
    const fv = segment.fields[35];
    if (Array.isArray(fv)) {
      result.$35_transcriptionist = fv.map(v => fromNDL(v)).filter((v): v is NDL => v !== undefined);
    } else {
      const converted = fromNDL(fv);
      if (converted) result.$35_transcriptionist = [converted];
    }
  }
  if (segment.fields[36] !== undefined) {
    const v = getComponent(segment.fields[36]);
    if (v !== undefined) result.$36_scheduledDateTime = v;
  }
  if (segment.fields[37] !== undefined) {
    const v = getComponent(segment.fields[37]);
    if (v !== undefined) result.$37_numberOfSampleContainers = v;
  }
  if (segment.fields[38] !== undefined) {
    const fv = segment.fields[38];
    if (Array.isArray(fv)) {
      result.$38_transportLogisticsOfCollectedSample = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$38_transportLogisticsOfCollectedSample = [converted];
    }
  }
  if (segment.fields[39] !== undefined) {
    const fv = segment.fields[39];
    if (Array.isArray(fv)) {
      result.$39_collectorsComment = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$39_collectorsComment = [converted];
    }
  }
  if (segment.fields[40] !== undefined) {
    const converted = fromCE(segment.fields[40]);
    if (converted) result.$40_transportArrangementResponsibility = converted;
  }
  if (segment.fields[41] !== undefined) {
    const v = getComponent(segment.fields[41]);
    if (v !== undefined) result.$41_transportArranged = v;
  }
  if (segment.fields[42] !== undefined) {
    const v = getComponent(segment.fields[42]);
    if (v !== undefined) result.$42_escortRequired = v;
  }
  if (segment.fields[43] !== undefined) {
    const fv = segment.fields[43];
    if (Array.isArray(fv)) {
      result.$43_plannedPatientTransportComment = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$43_plannedPatientTransportComment = [converted];
    }
  }
  if (segment.fields[44] !== undefined) {
    const converted = fromCE(segment.fields[44]);
    if (converted) result.$44_procedureCode = converted;
  }
  if (segment.fields[45] !== undefined) {
    const fv = segment.fields[45];
    if (Array.isArray(fv)) {
      result.$45_procedureCodeModifier = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$45_procedureCodeModifier = [converted];
    }
  }
  if (segment.fields[46] !== undefined) {
    const fv = segment.fields[46];
    if (Array.isArray(fv)) {
      result.$46_placerSupplementalInfo = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$46_placerSupplementalInfo = [converted];
    }
  }
  if (segment.fields[47] !== undefined) {
    const fv = segment.fields[47];
    if (Array.isArray(fv)) {
      result.$47_fillerSupplementalInfo = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$47_fillerSupplementalInfo = [converted];
    }
  }
  if (segment.fields[48] !== undefined) {
    const converted = fromCWE(segment.fields[48]);
    if (converted) result.$48_medicallyNecessaryDuplicateProcedureReason = converted;
  }
  if (segment.fields[49] !== undefined) {
    const v = getComponent(segment.fields[49]);
    if (v !== undefined) result.$49_resultHandling = v;
  }
  if (segment.fields[50] !== undefined) {
    const converted = fromCWE(segment.fields[50]);
    if (converted) result.$50_parentUniversalServiceIdentifier = converted;
  }
  return result;
}

/** Convert HL7v2Segment to OBX */
export function fromOBX(segment: HL7v2Segment): OBX {
  const result: OBX = {} as OBX;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdObx = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_valueType = v;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromCE(segment.fields[3]);
    if (converted) result.$3_observationIdentifier = converted;
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_observationSubId = v;
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_observationValue = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$5_observationValue = [fv];
    }
  }
  if (segment.fields[6] !== undefined) {
    const converted = fromCE(segment.fields[6]);
    if (converted) result.$6_unit = converted;
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_referencesRange = v;
  }
  if (segment.fields[8] !== undefined) {
    const fv = segment.fields[8];
    if (Array.isArray(fv)) {
      result.$8_abnormalFlags = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$8_abnormalFlags = [fv];
    }
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_probability = v;
  }
  if (segment.fields[10] !== undefined) {
    const fv = segment.fields[10];
    if (Array.isArray(fv)) {
      result.$10_natureOfAbnormalTest = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$10_natureOfAbnormalTest = [fv];
    }
  }
  if (segment.fields[11] !== undefined) {
    const v = getComponent(segment.fields[11]);
    if (v !== undefined) result.$11_observationResultStatus = v;
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_effectiveDateOfReferenceRangeValues = v;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_userDefinedAccessChecks = v;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_observationDateTime = v;
  }
  if (segment.fields[15] !== undefined) {
    const converted = fromCE(segment.fields[15]);
    if (converted) result.$15_producersReference = converted;
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_responsibleObserver = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$16_responsibleObserver = [converted];
    }
  }
  if (segment.fields[17] !== undefined) {
    const fv = segment.fields[17];
    if (Array.isArray(fv)) {
      result.$17_observationMethod = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$17_observationMethod = [converted];
    }
  }
  if (segment.fields[18] !== undefined) {
    const fv = segment.fields[18];
    if (Array.isArray(fv)) {
      result.$18_equipmentInstanceIdentifier = fv.map(v => fromEI(v)).filter((v): v is EI => v !== undefined);
    } else {
      const converted = fromEI(fv);
      if (converted) result.$18_equipmentInstanceIdentifier = [converted];
    }
  }
  if (segment.fields[19] !== undefined) {
    const v = getComponent(segment.fields[19]);
    if (v !== undefined) result.$19_analysisDateTime = v;
  }
  if (segment.fields[20] !== undefined) {
    const fv = segment.fields[20];
    if (Array.isArray(fv)) {
      result.$20_observationSite = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$20_observationSite = [converted];
    }
  }
  if (segment.fields[21] !== undefined) {
    const converted = fromEI(segment.fields[21]);
    if (converted) result.$21_observationInstanceIdentifier = converted;
  }
  if (segment.fields[22] !== undefined) {
    const converted = fromCNE(segment.fields[22]);
    if (converted) result.$22_moodIdentifier = converted;
  }
  if (segment.fields[23] !== undefined) {
    const converted = fromXON(segment.fields[23]);
    if (converted) result.$23_performingOrganizationName = converted;
  }
  if (segment.fields[24] !== undefined) {
    const converted = fromXAD(segment.fields[24]);
    if (converted) result.$24_performingOrganizationAddress = converted;
  }
  if (segment.fields[25] !== undefined) {
    const converted = fromXCN(segment.fields[25]);
    if (converted) result.$25_performingOrganizationMedicalDirector = converted;
  }
  return result;
}

/** Convert HL7v2Segment to ORC */
export function fromORC(segment: HL7v2Segment): ORC {
  const result: ORC = {} as ORC;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_orderControl = v;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromEI(segment.fields[2]);
    if (converted) result.$2_placerOrderNumber = converted;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromEI(segment.fields[3]);
    if (converted) result.$3_fillerOrderNumber = converted;
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromEI(segment.fields[4]);
    if (converted) result.$4_placerGroupNumber = converted;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_orderStatus = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_responseFlag = v;
  }
  if (segment.fields[7] !== undefined) {
    const fv = segment.fields[7];
    if (Array.isArray(fv)) {
      result.$7_timing = fv.map(v => fromTQ(v)).filter((v): v is TQ => v !== undefined);
    } else {
      const converted = fromTQ(fv);
      if (converted) result.$7_timing = [converted];
    }
  }
  if (segment.fields[8] !== undefined) {
    const converted = fromEIP(segment.fields[8]);
    if (converted) result.$8_parent = converted;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_transactionDateTime = v;
  }
  if (segment.fields[10] !== undefined) {
    const fv = segment.fields[10];
    if (Array.isArray(fv)) {
      result.$10_enteredBy = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$10_enteredBy = [converted];
    }
  }
  if (segment.fields[11] !== undefined) {
    const fv = segment.fields[11];
    if (Array.isArray(fv)) {
      result.$11_verifiedBy = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$11_verifiedBy = [converted];
    }
  }
  if (segment.fields[12] !== undefined) {
    const fv = segment.fields[12];
    if (Array.isArray(fv)) {
      result.$12_orderingProvider = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$12_orderingProvider = [converted];
    }
  }
  if (segment.fields[13] !== undefined) {
    const converted = fromPL(segment.fields[13]);
    if (converted) result.$13_enterersLocation = converted;
  }
  if (segment.fields[14] !== undefined) {
    const fv = segment.fields[14];
    if (Array.isArray(fv)) {
      result.$14_callbackPhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$14_callbackPhone = [converted];
    }
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_orderEffectiveDateTime = v;
  }
  if (segment.fields[16] !== undefined) {
    const converted = fromCE(segment.fields[16]);
    if (converted) result.$16_orderControlCodeReason = converted;
  }
  if (segment.fields[17] !== undefined) {
    const converted = fromCE(segment.fields[17]);
    if (converted) result.$17_enteringOrganization = converted;
  }
  if (segment.fields[18] !== undefined) {
    const converted = fromCE(segment.fields[18]);
    if (converted) result.$18_enteringDevice = converted;
  }
  if (segment.fields[19] !== undefined) {
    const fv = segment.fields[19];
    if (Array.isArray(fv)) {
      result.$19_actionBy = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$19_actionBy = [converted];
    }
  }
  if (segment.fields[20] !== undefined) {
    const converted = fromCE(segment.fields[20]);
    if (converted) result.$20_advancedBeneficiaryNoticeCode = converted;
  }
  if (segment.fields[21] !== undefined) {
    const fv = segment.fields[21];
    if (Array.isArray(fv)) {
      result.$21_orderingFacilityName = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$21_orderingFacilityName = [converted];
    }
  }
  if (segment.fields[22] !== undefined) {
    const fv = segment.fields[22];
    if (Array.isArray(fv)) {
      result.$22_orderingFacilityAddress = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$22_orderingFacilityAddress = [converted];
    }
  }
  if (segment.fields[23] !== undefined) {
    const fv = segment.fields[23];
    if (Array.isArray(fv)) {
      result.$23_orderingFacilityPhoneNumber = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$23_orderingFacilityPhoneNumber = [converted];
    }
  }
  if (segment.fields[24] !== undefined) {
    const fv = segment.fields[24];
    if (Array.isArray(fv)) {
      result.$24_orderingProviderAddress = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$24_orderingProviderAddress = [converted];
    }
  }
  if (segment.fields[25] !== undefined) {
    const converted = fromCWE(segment.fields[25]);
    if (converted) result.$25_orderStatusModifier = converted;
  }
  if (segment.fields[26] !== undefined) {
    const converted = fromCWE(segment.fields[26]);
    if (converted) result.$26_advancedBeneficiaryNoticeOverrideReason = converted;
  }
  if (segment.fields[27] !== undefined) {
    const v = getComponent(segment.fields[27]);
    if (v !== undefined) result.$27_fillersExpectedAvailabilityDateTime = v;
  }
  if (segment.fields[28] !== undefined) {
    const converted = fromCWE(segment.fields[28]);
    if (converted) result.$28_confidentialityCode = converted;
  }
  if (segment.fields[29] !== undefined) {
    const converted = fromCWE(segment.fields[29]);
    if (converted) result.$29_orderType = converted;
  }
  if (segment.fields[30] !== undefined) {
    const converted = fromCNE(segment.fields[30]);
    if (converted) result.$30_entererAuthorizationMode = converted;
  }
  if (segment.fields[31] !== undefined) {
    const converted = fromCWE(segment.fields[31]);
    if (converted) result.$31_parentUniversalServiceIdentifier = converted;
  }
  return result;
}

/** Convert HL7v2Segment to PD1 */
export function fromPD1(segment: HL7v2Segment): PD1 {
  const result: PD1 = {} as PD1;
  if (segment.fields[1] !== undefined) {
    const fv = segment.fields[1];
    if (Array.isArray(fv)) {
      result.$1_livingDependency = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$1_livingDependency = [fv];
    }
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_livingArrangement = v;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_primaryFacility = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$3_primaryFacility = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const fv = segment.fields[4];
    if (Array.isArray(fv)) {
      result.$4_primaryCareProvider = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$4_primaryCareProvider = [converted];
    }
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_student = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_disability = v;
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_livingWill = v;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_organDonorCode = v;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_separateBill = v;
  }
  if (segment.fields[10] !== undefined) {
    const fv = segment.fields[10];
    if (Array.isArray(fv)) {
      result.$10_duplicatePatient = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$10_duplicatePatient = [converted];
    }
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromCE(segment.fields[11]);
    if (converted) result.$11_publicityCode = converted;
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_protectionIndicator = v;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_protectionIndicatorEffectiveDate = v;
  }
  if (segment.fields[14] !== undefined) {
    const fv = segment.fields[14];
    if (Array.isArray(fv)) {
      result.$14_placeOfWorship = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$14_placeOfWorship = [converted];
    }
  }
  if (segment.fields[15] !== undefined) {
    const fv = segment.fields[15];
    if (Array.isArray(fv)) {
      result.$15_advanceDirectiveCode = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$15_advanceDirectiveCode = [converted];
    }
  }
  if (segment.fields[16] !== undefined) {
    const v = getComponent(segment.fields[16]);
    if (v !== undefined) result.$16_immunizationRegistryStatus = v;
  }
  if (segment.fields[17] !== undefined) {
    const v = getComponent(segment.fields[17]);
    if (v !== undefined) result.$17_immunizationRegistryStatusEffectiveDate = v;
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_publicityCodeEffectiveDate = v;
  }
  if (segment.fields[19] !== undefined) {
    const v = getComponent(segment.fields[19]);
    if (v !== undefined) result.$19_militaryBranch = v;
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_militaryRankGrade = v;
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_militaryStatus = v;
  }
  return result;
}

/** Convert HL7v2Segment to PID */
export function fromPID(segment: HL7v2Segment): PID {
  const result: PID = {} as PID;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdPid = v;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromCX(segment.fields[2]);
    if (converted) result.$2_patientId = converted;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_identifier = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$3_identifier = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const fv = segment.fields[4];
    if (Array.isArray(fv)) {
      result.$4_alternatePatientIdPid = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$4_alternatePatientIdPid = [converted];
    }
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_name = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$5_name = [converted];
    }
  }
  if (segment.fields[6] !== undefined) {
    const fv = segment.fields[6];
    if (Array.isArray(fv)) {
      result.$6_mothersMaidenName = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$6_mothersMaidenName = [converted];
    }
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_birthDate = v;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_gender = v;
  }
  if (segment.fields[9] !== undefined) {
    const fv = segment.fields[9];
    if (Array.isArray(fv)) {
      result.$9_alias = fv.map(v => fromXPN(v)).filter((v): v is XPN => v !== undefined);
    } else {
      const converted = fromXPN(fv);
      if (converted) result.$9_alias = [converted];
    }
  }
  if (segment.fields[10] !== undefined) {
    const fv = segment.fields[10];
    if (Array.isArray(fv)) {
      result.$10_race = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$10_race = [converted];
    }
  }
  if (segment.fields[11] !== undefined) {
    const fv = segment.fields[11];
    if (Array.isArray(fv)) {
      result.$11_address = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$11_address = [converted];
    }
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_countyCode = v;
  }
  if (segment.fields[13] !== undefined) {
    const fv = segment.fields[13];
    if (Array.isArray(fv)) {
      result.$13_homePhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$13_homePhone = [converted];
    }
  }
  if (segment.fields[14] !== undefined) {
    const fv = segment.fields[14];
    if (Array.isArray(fv)) {
      result.$14_businessPhone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$14_businessPhone = [converted];
    }
  }
  if (segment.fields[15] !== undefined) {
    const converted = fromCE(segment.fields[15]);
    if (converted) result.$15_language = converted;
  }
  if (segment.fields[16] !== undefined) {
    const converted = fromCE(segment.fields[16]);
    if (converted) result.$16_maritalStatus = converted;
  }
  if (segment.fields[17] !== undefined) {
    const converted = fromCE(segment.fields[17]);
    if (converted) result.$17_religion = converted;
  }
  if (segment.fields[18] !== undefined) {
    const converted = fromCX(segment.fields[18]);
    if (converted) result.$18_accountNumber = converted;
  }
  if (segment.fields[19] !== undefined) {
    const v = getComponent(segment.fields[19]);
    if (v !== undefined) result.$19_ssnNumberPatient = v;
  }
  if (segment.fields[20] !== undefined) {
    const converted = fromDLN(segment.fields[20]);
    if (converted) result.$20_driversLicenseNumberPatient = converted;
  }
  if (segment.fields[21] !== undefined) {
    const fv = segment.fields[21];
    if (Array.isArray(fv)) {
      result.$21_mothersIdentifier = fv.map(v => fromCX(v)).filter((v): v is CX => v !== undefined);
    } else {
      const converted = fromCX(fv);
      if (converted) result.$21_mothersIdentifier = [converted];
    }
  }
  if (segment.fields[22] !== undefined) {
    const fv = segment.fields[22];
    if (Array.isArray(fv)) {
      result.$22_ethnicity = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$22_ethnicity = [converted];
    }
  }
  if (segment.fields[23] !== undefined) {
    const v = getComponent(segment.fields[23]);
    if (v !== undefined) result.$23_birthPlace = v;
  }
  if (segment.fields[24] !== undefined) {
    const v = getComponent(segment.fields[24]);
    if (v !== undefined) result.$24_multipleBirthIndicator = v;
  }
  if (segment.fields[25] !== undefined) {
    const v = getComponent(segment.fields[25]);
    if (v !== undefined) result.$25_birthOrder = v;
  }
  if (segment.fields[26] !== undefined) {
    const fv = segment.fields[26];
    if (Array.isArray(fv)) {
      result.$26_citizenship = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$26_citizenship = [converted];
    }
  }
  if (segment.fields[27] !== undefined) {
    const converted = fromCE(segment.fields[27]);
    if (converted) result.$27_veteransMilitaryStatus = converted;
  }
  if (segment.fields[28] !== undefined) {
    const converted = fromCE(segment.fields[28]);
    if (converted) result.$28_nationality = converted;
  }
  if (segment.fields[29] !== undefined) {
    const v = getComponent(segment.fields[29]);
    if (v !== undefined) result.$29_deceasedDateTime = v;
  }
  if (segment.fields[30] !== undefined) {
    const v = getComponent(segment.fields[30]);
    if (v !== undefined) result.$30_deceased = v;
  }
  if (segment.fields[31] !== undefined) {
    const v = getComponent(segment.fields[31]);
    if (v !== undefined) result.$31_identityUnknownIndicator = v;
  }
  if (segment.fields[32] !== undefined) {
    const fv = segment.fields[32];
    if (Array.isArray(fv)) {
      result.$32_identityReliabilityCode = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$32_identityReliabilityCode = [fv];
    }
  }
  if (segment.fields[33] !== undefined) {
    const v = getComponent(segment.fields[33]);
    if (v !== undefined) result.$33_lastUpdateDateTime = v;
  }
  if (segment.fields[34] !== undefined) {
    const converted = fromHD(segment.fields[34]);
    if (converted) result.$34_lastUpdateFacility = converted;
  }
  if (segment.fields[35] !== undefined) {
    const converted = fromCE(segment.fields[35]);
    if (converted) result.$35_speciesCode = converted;
  }
  if (segment.fields[36] !== undefined) {
    const converted = fromCE(segment.fields[36]);
    if (converted) result.$36_breedCode = converted;
  }
  if (segment.fields[37] !== undefined) {
    const v = getComponent(segment.fields[37]);
    if (v !== undefined) result.$37_strain = v;
  }
  if (segment.fields[38] !== undefined) {
    const converted = fromCE(segment.fields[38]);
    if (converted) result.$38_productionClassCode = converted;
  }
  if (segment.fields[39] !== undefined) {
    const fv = segment.fields[39];
    if (Array.isArray(fv)) {
      result.$39_tribalCitizenship = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$39_tribalCitizenship = [converted];
    }
  }
  return result;
}

/** Convert HL7v2Segment to PR1 */
export function fromPR1(segment: HL7v2Segment): PR1 {
  const result: PR1 = {} as PR1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdPr1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_procedureCodingMethod = v;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromCE(segment.fields[3]);
    if (converted) result.$3_procedureCode = converted;
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_procedureDescription = v;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_procedureDateTime = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_procedureFunctionalType = v;
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_procedureMinutes = v;
  }
  if (segment.fields[8] !== undefined) {
    const fv = segment.fields[8];
    if (Array.isArray(fv)) {
      result.$8_anesthesiologist = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$8_anesthesiologist = [converted];
    }
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_anesthesiaCode = v;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_anesthesiaMinutes = v;
  }
  if (segment.fields[11] !== undefined) {
    const fv = segment.fields[11];
    if (Array.isArray(fv)) {
      result.$11_surgeon = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$11_surgeon = [converted];
    }
  }
  if (segment.fields[12] !== undefined) {
    const fv = segment.fields[12];
    if (Array.isArray(fv)) {
      result.$12_procedurePractitioner = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$12_procedurePractitioner = [converted];
    }
  }
  if (segment.fields[13] !== undefined) {
    const converted = fromCE(segment.fields[13]);
    if (converted) result.$13_consentCode = converted;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_procedurePriority = v;
  }
  if (segment.fields[15] !== undefined) {
    const converted = fromCE(segment.fields[15]);
    if (converted) result.$15_associatedDiagnosisCode = converted;
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_procedureCodeModifier = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$16_procedureCodeModifier = [converted];
    }
  }
  if (segment.fields[17] !== undefined) {
    const v = getComponent(segment.fields[17]);
    if (v !== undefined) result.$17_procedureDrgType = v;
  }
  if (segment.fields[18] !== undefined) {
    const fv = segment.fields[18];
    if (Array.isArray(fv)) {
      result.$18_tissueTypeCode = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$18_tissueTypeCode = [converted];
    }
  }
  if (segment.fields[19] !== undefined) {
    const converted = fromEI(segment.fields[19]);
    if (converted) result.$19_procedureIdentifier = converted;
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_procedureActionCode = v;
  }
  return result;
}

/** Convert HL7v2Segment to PV1 */
export function fromPV1(segment: HL7v2Segment): PV1 {
  const result: PV1 = {} as PV1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdPv1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_class = v;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromPL(segment.fields[3]);
    if (converted) result.$3_assignedPatientLocation = converted;
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_admissionType = v;
  }
  if (segment.fields[5] !== undefined) {
    const converted = fromCX(segment.fields[5]);
    if (converted) result.$5_preadmitNumber = converted;
  }
  if (segment.fields[6] !== undefined) {
    const converted = fromPL(segment.fields[6]);
    if (converted) result.$6_priorPatientLocation = converted;
  }
  if (segment.fields[7] !== undefined) {
    const fv = segment.fields[7];
    if (Array.isArray(fv)) {
      result.$7_attendingDoctor = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$7_attendingDoctor = [converted];
    }
  }
  if (segment.fields[8] !== undefined) {
    const fv = segment.fields[8];
    if (Array.isArray(fv)) {
      result.$8_referringDoctor = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$8_referringDoctor = [converted];
    }
  }
  if (segment.fields[9] !== undefined) {
    const fv = segment.fields[9];
    if (Array.isArray(fv)) {
      result.$9_consultingDoctor = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$9_consultingDoctor = [converted];
    }
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_hospitalService = v;
  }
  if (segment.fields[11] !== undefined) {
    const converted = fromPL(segment.fields[11]);
    if (converted) result.$11_temporaryLocation = converted;
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_preadmitTestIndicator = v;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_reAdmissionIndicator = v;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_admitSource = v;
  }
  if (segment.fields[15] !== undefined) {
    const fv = segment.fields[15];
    if (Array.isArray(fv)) {
      result.$15_ambulatoryStatus = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$15_ambulatoryStatus = [fv];
    }
  }
  if (segment.fields[16] !== undefined) {
    const v = getComponent(segment.fields[16]);
    if (v !== undefined) result.$16_vip = v;
  }
  if (segment.fields[17] !== undefined) {
    const fv = segment.fields[17];
    if (Array.isArray(fv)) {
      result.$17_admittingDoctor = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$17_admittingDoctor = [converted];
    }
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_type = v;
  }
  if (segment.fields[19] !== undefined) {
    const converted = fromCX(segment.fields[19]);
    if (converted) result.$19_visitNumber = converted;
  }
  if (segment.fields[20] !== undefined) {
    const fv = segment.fields[20];
    if (Array.isArray(fv)) {
      result.$20_financialClass = fv.map(v => fromFC(v)).filter((v): v is FC => v !== undefined);
    } else {
      const converted = fromFC(fv);
      if (converted) result.$20_financialClass = [converted];
    }
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_chargePriceIndicator = v;
  }
  if (segment.fields[22] !== undefined) {
    const v = getComponent(segment.fields[22]);
    if (v !== undefined) result.$22_courtesyCode = v;
  }
  if (segment.fields[23] !== undefined) {
    const v = getComponent(segment.fields[23]);
    if (v !== undefined) result.$23_creditRating = v;
  }
  if (segment.fields[24] !== undefined) {
    const fv = segment.fields[24];
    if (Array.isArray(fv)) {
      result.$24_contractCode = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$24_contractCode = [fv];
    }
  }
  if (segment.fields[25] !== undefined) {
    const fv = segment.fields[25];
    if (Array.isArray(fv)) {
      result.$25_contractEffectiveDate = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$25_contractEffectiveDate = [fv];
    }
  }
  if (segment.fields[26] !== undefined) {
    const fv = segment.fields[26];
    if (Array.isArray(fv)) {
      result.$26_contractAmount = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$26_contractAmount = [fv];
    }
  }
  if (segment.fields[27] !== undefined) {
    const fv = segment.fields[27];
    if (Array.isArray(fv)) {
      result.$27_contractPeriod = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$27_contractPeriod = [fv];
    }
  }
  if (segment.fields[28] !== undefined) {
    const v = getComponent(segment.fields[28]);
    if (v !== undefined) result.$28_interestCode = v;
  }
  if (segment.fields[29] !== undefined) {
    const v = getComponent(segment.fields[29]);
    if (v !== undefined) result.$29_transferToBadDebtCode = v;
  }
  if (segment.fields[30] !== undefined) {
    const v = getComponent(segment.fields[30]);
    if (v !== undefined) result.$30_transferToBadDebtDate = v;
  }
  if (segment.fields[31] !== undefined) {
    const v = getComponent(segment.fields[31]);
    if (v !== undefined) result.$31_badDebtAgencyCode = v;
  }
  if (segment.fields[32] !== undefined) {
    const v = getComponent(segment.fields[32]);
    if (v !== undefined) result.$32_badDebtTransferAmount = v;
  }
  if (segment.fields[33] !== undefined) {
    const v = getComponent(segment.fields[33]);
    if (v !== undefined) result.$33_badDebtRecoveryAmount = v;
  }
  if (segment.fields[34] !== undefined) {
    const v = getComponent(segment.fields[34]);
    if (v !== undefined) result.$34_deleteAccountIndicator = v;
  }
  if (segment.fields[35] !== undefined) {
    const v = getComponent(segment.fields[35]);
    if (v !== undefined) result.$35_deleteAccountDate = v;
  }
  if (segment.fields[36] !== undefined) {
    const v = getComponent(segment.fields[36]);
    if (v !== undefined) result.$36_dischargeDisposition = v;
  }
  if (segment.fields[37] !== undefined) {
    const converted = fromDLD(segment.fields[37]);
    if (converted) result.$37_dischargedToLocation = converted;
  }
  if (segment.fields[38] !== undefined) {
    const converted = fromCE(segment.fields[38]);
    if (converted) result.$38_dietType = converted;
  }
  if (segment.fields[39] !== undefined) {
    const v = getComponent(segment.fields[39]);
    if (v !== undefined) result.$39_servicingFacility = v;
  }
  if (segment.fields[40] !== undefined) {
    const v = getComponent(segment.fields[40]);
    if (v !== undefined) result.$40_bedStatus = v;
  }
  if (segment.fields[41] !== undefined) {
    const v = getComponent(segment.fields[41]);
    if (v !== undefined) result.$41_accountStatus = v;
  }
  if (segment.fields[42] !== undefined) {
    const converted = fromPL(segment.fields[42]);
    if (converted) result.$42_pendingLocation = converted;
  }
  if (segment.fields[43] !== undefined) {
    const converted = fromPL(segment.fields[43]);
    if (converted) result.$43_priorTemporaryLocation = converted;
  }
  if (segment.fields[44] !== undefined) {
    const v = getComponent(segment.fields[44]);
    if (v !== undefined) result.$44_admission = v;
  }
  if (segment.fields[45] !== undefined) {
    const fv = segment.fields[45];
    if (Array.isArray(fv)) {
      result.$45_discharge = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$45_discharge = [fv];
    }
  }
  if (segment.fields[46] !== undefined) {
    const v = getComponent(segment.fields[46]);
    if (v !== undefined) result.$46_currentPatientBalance = v;
  }
  if (segment.fields[47] !== undefined) {
    const v = getComponent(segment.fields[47]);
    if (v !== undefined) result.$47_totalCharges = v;
  }
  if (segment.fields[48] !== undefined) {
    const v = getComponent(segment.fields[48]);
    if (v !== undefined) result.$48_totalAdjustments = v;
  }
  if (segment.fields[49] !== undefined) {
    const v = getComponent(segment.fields[49]);
    if (v !== undefined) result.$49_totalPayments = v;
  }
  if (segment.fields[50] !== undefined) {
    const converted = fromCX(segment.fields[50]);
    if (converted) result.$50_alternateVisitId = converted;
  }
  if (segment.fields[51] !== undefined) {
    const v = getComponent(segment.fields[51]);
    if (v !== undefined) result.$51_visitIndicator = v;
  }
  if (segment.fields[52] !== undefined) {
    const fv = segment.fields[52];
    if (Array.isArray(fv)) {
      result.$52_otherHealthcareProvider = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$52_otherHealthcareProvider = [converted];
    }
  }
  return result;
}

/** Convert HL7v2Segment to PV2 */
export function fromPV2(segment: HL7v2Segment): PV2 {
  const result: PV2 = {} as PV2;
  if (segment.fields[1] !== undefined) {
    const converted = fromPL(segment.fields[1]);
    if (converted) result.$1_priorPendingLocation = converted;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromCE(segment.fields[2]);
    if (converted) result.$2_accommodationCode = converted;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromCE(segment.fields[3]);
    if (converted) result.$3_admitReason = converted;
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromCE(segment.fields[4]);
    if (converted) result.$4_transferReason = converted;
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_valuables = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$5_valuables = [fv];
    }
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_valuablesLocation = v;
  }
  if (segment.fields[7] !== undefined) {
    const fv = segment.fields[7];
    if (Array.isArray(fv)) {
      result.$7_visitUserCode = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$7_visitUserCode = [fv];
    }
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_expectedAdmission = v;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_expectedDischarge = v;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_estimatedLengthOfInpatientStay = v;
  }
  if (segment.fields[11] !== undefined) {
    const v = getComponent(segment.fields[11]);
    if (v !== undefined) result.$11_actualLengthOfInpatientStay = v;
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_visitDescription = v;
  }
  if (segment.fields[13] !== undefined) {
    const fv = segment.fields[13];
    if (Array.isArray(fv)) {
      result.$13_referralSourceCode = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$13_referralSourceCode = [converted];
    }
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_previousServiceDate = v;
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_employmentIllnessRelatedIndicator = v;
  }
  if (segment.fields[16] !== undefined) {
    const v = getComponent(segment.fields[16]);
    if (v !== undefined) result.$16_purgeStatusCode = v;
  }
  if (segment.fields[17] !== undefined) {
    const v = getComponent(segment.fields[17]);
    if (v !== undefined) result.$17_purgeStatusDate = v;
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_specialProgramCode = v;
  }
  if (segment.fields[19] !== undefined) {
    const v = getComponent(segment.fields[19]);
    if (v !== undefined) result.$19_retentionIndicator = v;
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_expectedNumberOfInsurancePlans = v;
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_visitPublicityCode = v;
  }
  if (segment.fields[22] !== undefined) {
    const v = getComponent(segment.fields[22]);
    if (v !== undefined) result.$22_visitProtectionIndicator = v;
  }
  if (segment.fields[23] !== undefined) {
    const fv = segment.fields[23];
    if (Array.isArray(fv)) {
      result.$23_clinicOrganizationName = fv.map(v => fromXON(v)).filter((v): v is XON => v !== undefined);
    } else {
      const converted = fromXON(fv);
      if (converted) result.$23_clinicOrganizationName = [converted];
    }
  }
  if (segment.fields[24] !== undefined) {
    const v = getComponent(segment.fields[24]);
    if (v !== undefined) result.$24_status = v;
  }
  if (segment.fields[25] !== undefined) {
    const v = getComponent(segment.fields[25]);
    if (v !== undefined) result.$25_visitPriorityCode = v;
  }
  if (segment.fields[26] !== undefined) {
    const v = getComponent(segment.fields[26]);
    if (v !== undefined) result.$26_previousTreatmentDate = v;
  }
  if (segment.fields[27] !== undefined) {
    const v = getComponent(segment.fields[27]);
    if (v !== undefined) result.$27_expectedDischargeDisposition = v;
  }
  if (segment.fields[28] !== undefined) {
    const v = getComponent(segment.fields[28]);
    if (v !== undefined) result.$28_signatureOnFileDate = v;
  }
  if (segment.fields[29] !== undefined) {
    const v = getComponent(segment.fields[29]);
    if (v !== undefined) result.$29_firstSimilarIllnessDate = v;
  }
  if (segment.fields[30] !== undefined) {
    const converted = fromCE(segment.fields[30]);
    if (converted) result.$30_chargeAdjustmentCode = converted;
  }
  if (segment.fields[31] !== undefined) {
    const v = getComponent(segment.fields[31]);
    if (v !== undefined) result.$31_recurringServiceCode = v;
  }
  if (segment.fields[32] !== undefined) {
    const v = getComponent(segment.fields[32]);
    if (v !== undefined) result.$32_billingMediaCode = v;
  }
  if (segment.fields[33] !== undefined) {
    const v = getComponent(segment.fields[33]);
    if (v !== undefined) result.$33_expectedSurgeryDateAndTime = v;
  }
  if (segment.fields[34] !== undefined) {
    const v = getComponent(segment.fields[34]);
    if (v !== undefined) result.$34_militaryPartnershipCode = v;
  }
  if (segment.fields[35] !== undefined) {
    const v = getComponent(segment.fields[35]);
    if (v !== undefined) result.$35_militaryNonAvailabilityCode = v;
  }
  if (segment.fields[36] !== undefined) {
    const v = getComponent(segment.fields[36]);
    if (v !== undefined) result.$36_newbornBabyIndicator = v;
  }
  if (segment.fields[37] !== undefined) {
    const v = getComponent(segment.fields[37]);
    if (v !== undefined) result.$37_babyDetainedIndicator = v;
  }
  if (segment.fields[38] !== undefined) {
    const converted = fromCE(segment.fields[38]);
    if (converted) result.$38_modeOfArrivalCode = converted;
  }
  if (segment.fields[39] !== undefined) {
    const fv = segment.fields[39];
    if (Array.isArray(fv)) {
      result.$39_recreationalDrugUseCode = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$39_recreationalDrugUseCode = [converted];
    }
  }
  if (segment.fields[40] !== undefined) {
    const converted = fromCE(segment.fields[40]);
    if (converted) result.$40_admissionLevelOfCareCode = converted;
  }
  if (segment.fields[41] !== undefined) {
    const fv = segment.fields[41];
    if (Array.isArray(fv)) {
      result.$41_precautionCode = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$41_precautionCode = [converted];
    }
  }
  if (segment.fields[42] !== undefined) {
    const converted = fromCE(segment.fields[42]);
    if (converted) result.$42_conditionCode = converted;
  }
  if (segment.fields[43] !== undefined) {
    const v = getComponent(segment.fields[43]);
    if (v !== undefined) result.$43_livingWill = v;
  }
  if (segment.fields[44] !== undefined) {
    const v = getComponent(segment.fields[44]);
    if (v !== undefined) result.$44_organDonorCode = v;
  }
  if (segment.fields[45] !== undefined) {
    const fv = segment.fields[45];
    if (Array.isArray(fv)) {
      result.$45_advanceDirectiveCode = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$45_advanceDirectiveCode = [converted];
    }
  }
  if (segment.fields[46] !== undefined) {
    const v = getComponent(segment.fields[46]);
    if (v !== undefined) result.$46_statusStart = v;
  }
  if (segment.fields[47] !== undefined) {
    const v = getComponent(segment.fields[47]);
    if (v !== undefined) result.$47_expectedLoaReturnDateTime = v;
  }
  if (segment.fields[48] !== undefined) {
    const v = getComponent(segment.fields[48]);
    if (v !== undefined) result.$48_expectedPreAdmissionTestingDateTime = v;
  }
  if (segment.fields[49] !== undefined) {
    const fv = segment.fields[49];
    if (Array.isArray(fv)) {
      result.$49_notifyClergyCode = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$49_notifyClergyCode = [fv];
    }
  }
  return result;
}

/** Convert HL7v2Segment to ROL */
export function fromROL(segment: HL7v2Segment): ROL {
  const result: ROL = {} as ROL;
  if (segment.fields[1] !== undefined) {
    const converted = fromEI(segment.fields[1]);
    if (converted) result.$1_roleInstanceId = converted;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_actionCode = v;
  }
  if (segment.fields[3] !== undefined) {
    const converted = fromCE(segment.fields[3]);
    if (converted) result.$3_roleRol = converted;
  }
  if (segment.fields[4] !== undefined) {
    const fv = segment.fields[4];
    if (Array.isArray(fv)) {
      result.$4_rolePerson = fv.map(v => fromXCN(v)).filter((v): v is XCN => v !== undefined);
    } else {
      const converted = fromXCN(fv);
      if (converted) result.$4_rolePerson = [converted];
    }
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_roleBeginDateTime = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_roleEndDateTime = v;
  }
  if (segment.fields[7] !== undefined) {
    const converted = fromCE(segment.fields[7]);
    if (converted) result.$7_roleDuration = converted;
  }
  if (segment.fields[8] !== undefined) {
    const converted = fromCE(segment.fields[8]);
    if (converted) result.$8_roleActionReason = converted;
  }
  if (segment.fields[9] !== undefined) {
    const fv = segment.fields[9];
    if (Array.isArray(fv)) {
      result.$9_providerType = fv.map(v => fromCE(v)).filter((v): v is CE => v !== undefined);
    } else {
      const converted = fromCE(fv);
      if (converted) result.$9_providerType = [converted];
    }
  }
  if (segment.fields[10] !== undefined) {
    const converted = fromCE(segment.fields[10]);
    if (converted) result.$10_organizationUnitType = converted;
  }
  if (segment.fields[11] !== undefined) {
    const fv = segment.fields[11];
    if (Array.isArray(fv)) {
      result.$11_address = fv.map(v => fromXAD(v)).filter((v): v is XAD => v !== undefined);
    } else {
      const converted = fromXAD(fv);
      if (converted) result.$11_address = [converted];
    }
  }
  if (segment.fields[12] !== undefined) {
    const fv = segment.fields[12];
    if (Array.isArray(fv)) {
      result.$12_phone = fv.map(v => fromXTN(v)).filter((v): v is XTN => v !== undefined);
    } else {
      const converted = fromXTN(fv);
      if (converted) result.$12_phone = [converted];
    }
  }
  return result;
}

/** Convert HL7v2Segment to SFT */
export function fromSFT(segment: HL7v2Segment): SFT {
  const result: SFT = {} as SFT;
  if (segment.fields[1] !== undefined) {
    const converted = fromXON(segment.fields[1]);
    if (converted) result.$1_softwareVendorOrganization = converted;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_softwareCertifiedVersionOrReleaseNumber = v;
  }
  if (segment.fields[3] !== undefined) {
    const v = getComponent(segment.fields[3]);
    if (v !== undefined) result.$3_softwareProductName = v;
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_softwareBinaryId = v;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_softwareProductInformation = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_softwareInstallDate = v;
  }
  return result;
}

/** Convert HL7v2Segment to SPM */
export function fromSPM(segment: HL7v2Segment): SPM {
  const result: SPM = {} as SPM;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdSpm = v;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromEIP(segment.fields[2]);
    if (converted) result.$2_specimenId = converted;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_specimenParentIds = fv.map(v => fromEIP(v)).filter((v): v is EIP => v !== undefined);
    } else {
      const converted = fromEIP(fv);
      if (converted) result.$3_specimenParentIds = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const converted = fromCWE(segment.fields[4]);
    if (converted) result.$4_specimenType = converted;
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_specimenTypeModifier = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$5_specimenTypeModifier = [converted];
    }
  }
  if (segment.fields[6] !== undefined) {
    const fv = segment.fields[6];
    if (Array.isArray(fv)) {
      result.$6_specimenAdditives = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$6_specimenAdditives = [converted];
    }
  }
  if (segment.fields[7] !== undefined) {
    const converted = fromCWE(segment.fields[7]);
    if (converted) result.$7_collectionMethod = converted;
  }
  if (segment.fields[8] !== undefined) {
    const converted = fromCWE(segment.fields[8]);
    if (converted) result.$8_specimenSourceSite = converted;
  }
  if (segment.fields[9] !== undefined) {
    const fv = segment.fields[9];
    if (Array.isArray(fv)) {
      result.$9_specimenSourceSiteModifier = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$9_specimenSourceSiteModifier = [converted];
    }
  }
  if (segment.fields[10] !== undefined) {
    const converted = fromCWE(segment.fields[10]);
    if (converted) result.$10_specimenCollectionSite = converted;
  }
  if (segment.fields[11] !== undefined) {
    const fv = segment.fields[11];
    if (Array.isArray(fv)) {
      result.$11_role = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$11_role = [converted];
    }
  }
  if (segment.fields[12] !== undefined) {
    const converted = fromCQ(segment.fields[12]);
    if (converted) result.$12_specimenCollectionAmount = converted;
  }
  if (segment.fields[13] !== undefined) {
    const v = getComponent(segment.fields[13]);
    if (v !== undefined) result.$13_groupedSpecimenCount = v;
  }
  if (segment.fields[14] !== undefined) {
    const fv = segment.fields[14];
    if (Array.isArray(fv)) {
      result.$14_specimenDescription = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$14_specimenDescription = [fv];
    }
  }
  if (segment.fields[15] !== undefined) {
    const fv = segment.fields[15];
    if (Array.isArray(fv)) {
      result.$15_specimenHandlingCode = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$15_specimenHandlingCode = [converted];
    }
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_specimenRiskCode = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$16_specimenRiskCode = [converted];
    }
  }
  if (segment.fields[17] !== undefined) {
    const converted = fromDR(segment.fields[17]);
    if (converted) result.$17_specimenCollection = converted;
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_specimenReceived = v;
  }
  if (segment.fields[19] !== undefined) {
    const v = getComponent(segment.fields[19]);
    if (v !== undefined) result.$19_specimenExpiration = v;
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_specimenAvailability = v;
  }
  if (segment.fields[21] !== undefined) {
    const fv = segment.fields[21];
    if (Array.isArray(fv)) {
      result.$21_specimenRejectReason = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$21_specimenRejectReason = [converted];
    }
  }
  if (segment.fields[22] !== undefined) {
    const converted = fromCWE(segment.fields[22]);
    if (converted) result.$22_specimenQuality = converted;
  }
  if (segment.fields[23] !== undefined) {
    const converted = fromCWE(segment.fields[23]);
    if (converted) result.$23_specimenAppropriateness = converted;
  }
  if (segment.fields[24] !== undefined) {
    const fv = segment.fields[24];
    if (Array.isArray(fv)) {
      result.$24_specimenCondition = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$24_specimenCondition = [converted];
    }
  }
  if (segment.fields[25] !== undefined) {
    const converted = fromCQ(segment.fields[25]);
    if (converted) result.$25_specimenCurrentQuantity = converted;
  }
  if (segment.fields[26] !== undefined) {
    const v = getComponent(segment.fields[26]);
    if (v !== undefined) result.$26_numberOfSpecimenContainers = v;
  }
  if (segment.fields[27] !== undefined) {
    const converted = fromCWE(segment.fields[27]);
    if (converted) result.$27_containerType = converted;
  }
  if (segment.fields[28] !== undefined) {
    const converted = fromCWE(segment.fields[28]);
    if (converted) result.$28_containerCondition = converted;
  }
  if (segment.fields[29] !== undefined) {
    const converted = fromCWE(segment.fields[29]);
    if (converted) result.$29_specimenChildRole = converted;
  }
  return result;
}

/** Convert HL7v2Segment to TQ1 */
export function fromTQ1(segment: HL7v2Segment): TQ1 {
  const result: TQ1 = {} as TQ1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdTq1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const converted = fromCQ(segment.fields[2]);
    if (converted) result.$2_value = converted;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_pattern = fv.map(v => fromRPT(v)).filter((v): v is RPT => v !== undefined);
    } else {
      const converted = fromRPT(fv);
      if (converted) result.$3_pattern = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const fv = segment.fields[4];
    if (Array.isArray(fv)) {
      result.$4_explicitTime = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$4_explicitTime = [fv];
    }
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_relativeTimeAndUnit = fv.map(v => fromCQ(v)).filter((v): v is CQ => v !== undefined);
    } else {
      const converted = fromCQ(fv);
      if (converted) result.$5_relativeTimeAndUnit = [converted];
    }
  }
  if (segment.fields[6] !== undefined) {
    const converted = fromCQ(segment.fields[6]);
    if (converted) result.$6_serviceDuration = converted;
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_start = v;
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_end = v;
  }
  if (segment.fields[9] !== undefined) {
    const fv = segment.fields[9];
    if (Array.isArray(fv)) {
      result.$9_priority = fv.map(v => fromCWE(v)).filter((v): v is CWE => v !== undefined);
    } else {
      const converted = fromCWE(fv);
      if (converted) result.$9_priority = [converted];
    }
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_conditionText = v;
  }
  if (segment.fields[11] !== undefined) {
    const v = getComponent(segment.fields[11]);
    if (v !== undefined) result.$11_textInstruction = v;
  }
  if (segment.fields[12] !== undefined) {
    const v = getComponent(segment.fields[12]);
    if (v !== undefined) result.$12_conjunction = v;
  }
  if (segment.fields[13] !== undefined) {
    const converted = fromCQ(segment.fields[13]);
    if (converted) result.$13_occurrenceDuration = converted;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_totalOccurrences = v;
  }
  return result;
}

/** Convert HL7v2Segment to TQ2 */
export function fromTQ2(segment: HL7v2Segment): TQ2 {
  const result: TQ2 = {} as TQ2;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdTq2 = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_flag = v;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_relatedPlacerNumber = fv.map(v => fromEI(v)).filter((v): v is EI => v !== undefined);
    } else {
      const converted = fromEI(fv);
      if (converted) result.$3_relatedPlacerNumber = [converted];
    }
  }
  if (segment.fields[4] !== undefined) {
    const fv = segment.fields[4];
    if (Array.isArray(fv)) {
      result.$4_relatedFillerNumber = fv.map(v => fromEI(v)).filter((v): v is EI => v !== undefined);
    } else {
      const converted = fromEI(fv);
      if (converted) result.$4_relatedFillerNumber = [converted];
    }
  }
  if (segment.fields[5] !== undefined) {
    const fv = segment.fields[5];
    if (Array.isArray(fv)) {
      result.$5_relatedPlacerGroupNumber = fv.map(v => fromEI(v)).filter((v): v is EI => v !== undefined);
    } else {
      const converted = fromEI(fv);
      if (converted) result.$5_relatedPlacerGroupNumber = [converted];
    }
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_sequenceConditionCode = v;
  }
  if (segment.fields[7] !== undefined) {
    const v = getComponent(segment.fields[7]);
    if (v !== undefined) result.$7_cyclicEntryExitIndicator = v;
  }
  if (segment.fields[8] !== undefined) {
    const converted = fromCQ(segment.fields[8]);
    if (converted) result.$8_sequenceConditionTimeInterval = converted;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_cyclicGroupMaximumNumberOfRepeats = v;
  }
  if (segment.fields[10] !== undefined) {
    const v = getComponent(segment.fields[10]);
    if (v !== undefined) result.$10_specialServiceRequestRelationship = v;
  }
  return result;
}

/** Convert HL7v2Segment to UB1 */
export function fromUB1(segment: HL7v2Segment): UB1 {
  const result: UB1 = {} as UB1;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdUb1 = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_bloodDeductible = v;
  }
  if (segment.fields[3] !== undefined) {
    const v = getComponent(segment.fields[3]);
    if (v !== undefined) result.$3_bloodFurnishedPintsOf = v;
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_bloodReplacedPints = v;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_bloodNotReplacedPints = v;
  }
  if (segment.fields[6] !== undefined) {
    const v = getComponent(segment.fields[6]);
    if (v !== undefined) result.$6_coInsuranceDays = v;
  }
  if (segment.fields[7] !== undefined) {
    const fv = segment.fields[7];
    if (Array.isArray(fv)) {
      result.$7_conditionCode = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$7_conditionCode = [fv];
    }
  }
  if (segment.fields[8] !== undefined) {
    const v = getComponent(segment.fields[8]);
    if (v !== undefined) result.$8_coveredDays = v;
  }
  if (segment.fields[9] !== undefined) {
    const v = getComponent(segment.fields[9]);
    if (v !== undefined) result.$9_nonCoveredDays = v;
  }
  if (segment.fields[10] !== undefined) {
    const fv = segment.fields[10];
    if (Array.isArray(fv)) {
      result.$10_valueAmountAndCode = fv.map(v => fromUVC(v)).filter((v): v is UVC => v !== undefined);
    } else {
      const converted = fromUVC(fv);
      if (converted) result.$10_valueAmountAndCode = [converted];
    }
  }
  if (segment.fields[11] !== undefined) {
    const v = getComponent(segment.fields[11]);
    if (v !== undefined) result.$11_numberOfGraceDays = v;
  }
  if (segment.fields[12] !== undefined) {
    const converted = fromCE(segment.fields[12]);
    if (converted) result.$12_specialProgramIndicator = converted;
  }
  if (segment.fields[13] !== undefined) {
    const converted = fromCE(segment.fields[13]);
    if (converted) result.$13_psroUrApprovalIndicator = converted;
  }
  if (segment.fields[14] !== undefined) {
    const v = getComponent(segment.fields[14]);
    if (v !== undefined) result.$14_psroUrApprovedStayFm = v;
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_psroUrApprovedStayTo = v;
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_occurrence = fv.map(v => fromOCD(v)).filter((v): v is OCD => v !== undefined);
    } else {
      const converted = fromOCD(fv);
      if (converted) result.$16_occurrence = [converted];
    }
  }
  if (segment.fields[17] !== undefined) {
    const converted = fromCE(segment.fields[17]);
    if (converted) result.$17_occurrenceSpan = converted;
  }
  if (segment.fields[18] !== undefined) {
    const v = getComponent(segment.fields[18]);
    if (v !== undefined) result.$18_occurSpanStartDate = v;
  }
  if (segment.fields[19] !== undefined) {
    const v = getComponent(segment.fields[19]);
    if (v !== undefined) result.$19_occurSpanEndDate = v;
  }
  if (segment.fields[20] !== undefined) {
    const v = getComponent(segment.fields[20]);
    if (v !== undefined) result.$20_ub82Locator2 = v;
  }
  if (segment.fields[21] !== undefined) {
    const v = getComponent(segment.fields[21]);
    if (v !== undefined) result.$21_ub82Locator9 = v;
  }
  if (segment.fields[22] !== undefined) {
    const v = getComponent(segment.fields[22]);
    if (v !== undefined) result.$22_ub82Locator27 = v;
  }
  if (segment.fields[23] !== undefined) {
    const v = getComponent(segment.fields[23]);
    if (v !== undefined) result.$23_ub82Locator45 = v;
  }
  return result;
}

/** Convert HL7v2Segment to UB2 */
export function fromUB2(segment: HL7v2Segment): UB2 {
  const result: UB2 = {} as UB2;
  if (segment.fields[1] !== undefined) {
    const v = getComponent(segment.fields[1]);
    if (v !== undefined) result.$1_setIdUb2 = v;
  }
  if (segment.fields[2] !== undefined) {
    const v = getComponent(segment.fields[2]);
    if (v !== undefined) result.$2_coInsuranceDays = v;
  }
  if (segment.fields[3] !== undefined) {
    const fv = segment.fields[3];
    if (Array.isArray(fv)) {
      result.$3_conditionCode = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$3_conditionCode = [fv];
    }
  }
  if (segment.fields[4] !== undefined) {
    const v = getComponent(segment.fields[4]);
    if (v !== undefined) result.$4_coveredDays = v;
  }
  if (segment.fields[5] !== undefined) {
    const v = getComponent(segment.fields[5]);
    if (v !== undefined) result.$5_nonCoveredDays = v;
  }
  if (segment.fields[6] !== undefined) {
    const fv = segment.fields[6];
    if (Array.isArray(fv)) {
      result.$6_valueAmountAndCode = fv.map(v => fromUVC(v)).filter((v): v is UVC => v !== undefined);
    } else {
      const converted = fromUVC(fv);
      if (converted) result.$6_valueAmountAndCode = [converted];
    }
  }
  if (segment.fields[7] !== undefined) {
    const fv = segment.fields[7];
    if (Array.isArray(fv)) {
      result.$7_occurrenceCodeAndDate = fv.map(v => fromOCD(v)).filter((v): v is OCD => v !== undefined);
    } else {
      const converted = fromOCD(fv);
      if (converted) result.$7_occurrenceCodeAndDate = [converted];
    }
  }
  if (segment.fields[8] !== undefined) {
    const fv = segment.fields[8];
    if (Array.isArray(fv)) {
      result.$8_occurrenceSpanCodeDates = fv.map(v => fromOSP(v)).filter((v): v is OSP => v !== undefined);
    } else {
      const converted = fromOSP(fv);
      if (converted) result.$8_occurrenceSpanCodeDates = [converted];
    }
  }
  if (segment.fields[9] !== undefined) {
    const fv = segment.fields[9];
    if (Array.isArray(fv)) {
      result.$9_ub92Locator2 = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$9_ub92Locator2 = [fv];
    }
  }
  if (segment.fields[10] !== undefined) {
    const fv = segment.fields[10];
    if (Array.isArray(fv)) {
      result.$10_ub92Locator11 = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$10_ub92Locator11 = [fv];
    }
  }
  if (segment.fields[11] !== undefined) {
    const v = getComponent(segment.fields[11]);
    if (v !== undefined) result.$11_ub92Locator31 = v;
  }
  if (segment.fields[12] !== undefined) {
    const fv = segment.fields[12];
    if (Array.isArray(fv)) {
      result.$12_documentControlNumber = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$12_documentControlNumber = [fv];
    }
  }
  if (segment.fields[13] !== undefined) {
    const fv = segment.fields[13];
    if (Array.isArray(fv)) {
      result.$13_ub92Locator49 = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$13_ub92Locator49 = [fv];
    }
  }
  if (segment.fields[14] !== undefined) {
    const fv = segment.fields[14];
    if (Array.isArray(fv)) {
      result.$14_ub92Locator56 = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$14_ub92Locator56 = [fv];
    }
  }
  if (segment.fields[15] !== undefined) {
    const v = getComponent(segment.fields[15]);
    if (v !== undefined) result.$15_ub92Locator57 = v;
  }
  if (segment.fields[16] !== undefined) {
    const fv = segment.fields[16];
    if (Array.isArray(fv)) {
      result.$16_ub92Locator78 = fv.map(v => typeof v === "string" ? v : getComponent(v)).filter((v): v is string => v !== undefined);
    } else if (typeof fv === "string") {
      result.$16_ub92Locator78 = [fv];
    }
  }
  if (segment.fields[17] !== undefined) {
    const v = getComponent(segment.fields[17]);
    if (v !== undefined) result.$17_specialVisitCount = v;
  }
  return result;
}
