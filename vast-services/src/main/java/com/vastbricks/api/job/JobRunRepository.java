package com.vastbricks.api.job;

import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.DependsOn;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

@DependsOn("vastDatabaseMigration")
interface JobRunRepository extends JpaRepository<JobRun, Long> {

    // No tenant in any signature on purpose: Hibernate adds it from the entity's @TenantId. A tenant named here
    // would be a second, forgettable answer to a question already answered.

    Optional<JobRun> findFirstByJobCodeOrderByStartedAtDescIdDesc(String jobCode);

    List<JobRun> findByJobCodeOrderByStartedAtDescIdDesc(String jobCode, Limit limit);

    List<JobRun> findByOutcome(JobOutcome outcome);
}
