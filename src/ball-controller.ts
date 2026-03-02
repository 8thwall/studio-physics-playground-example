import * as ecs from '@8thwall/ecs'

// Shared data object for camera angles
const ballCameraData = {
  azimuthAngle: 0,
}

const ballController = ecs.registerComponent({
  name: 'ballController',
  schema: {
    force: ecs.f32,              // Ball movement force
    jumpForce: ecs.f32,          // Ball jump force
    jumpControlFactor: ecs.f32,  // Air control factor
    torqueForce: ecs.f32,        // Torque force when modifier is enabled
  },
  schemaDefaults: {
    force: 10.0,
    jumpForce: 8.0,
    jumpControlFactor: 0.25,
    torqueForce: 50.0,
  },
  data: {
    isGrounded: ecs.boolean,  // Tracks if the ball is touching the ground
    collisionCount: ecs.i32,  // Counts active collisions
    lastPositionX: ecs.f32,   // Previous X position for velocity calculation
    lastPositionY: ecs.f32,   // Previous Y position for velocity calculation
    lastPositionZ: ecs.f32,   // Previous Z position for velocity calculation
    velocityX: ecs.f32,       // Current velocity X component
    velocityZ: ecs.f32,       // Current velocity Z component
    isActive: ecs.boolean,    // Whether this controller is currently active
  },
  stateMachine: ({world, eid, dataAttribute}) => {
    // Helper function to update grounded state based on collisions
    const updateGroundedState = () => {
      const data = dataAttribute.cursor(eid)
      data.isGrounded = data.collisionCount > 0
    }

    // Handle start of a collision
    const handleCollisionStart = () => {
      const data = dataAttribute.cursor(eid)
      data.collisionCount++
      updateGroundedState()
    }

    // Handle end of a collision
    const handleCollisionEnd = () => {
      const data = dataAttribute.cursor(eid)
      data.collisionCount = Math.max(0, data.collisionCount - 1)
      updateGroundedState()
    }

    // Handle vehicle controller change events
    const handleVehicleChange = (event: any) => {
      const data = dataAttribute.cursor(eid)
      // Check if the event is for this entity
      if (event.data.vehicleEid === eid) {
        // Update active state based on the controller type
        data.isActive = (event.data.controller === 'ball')
      }
    }

    ecs.defineState('active').initial()
      .onEnter(() => {
        // Initialize controller data
        const data = dataAttribute.cursor(eid)
        data.isGrounded = false
        data.collisionCount = 0
        data.isActive = true  // Default to active (will be updated by events)

        // Initialize with current position
        const currentPos = world.transform.getWorldPosition(eid)
        data.lastPositionX = currentPos.x
        data.lastPositionY = currentPos.y
        data.lastPositionZ = currentPos.z
        data.velocityX = 0
        data.velocityZ = 0

        // Set up collision listeners
        world.events.addListener(eid, ecs.physics.COLLISION_START_EVENT, handleCollisionStart)
        world.events.addListener(eid, ecs.physics.COLLISION_END_EVENT, handleCollisionEnd)

        // Listen for global vehicle controller change events
        world.events.addListener(world.events.globalId, 'vehicle-controller-changed', handleVehicleChange)

        updateGroundedState()
      })
      .onExit(() => {
        // Clean up all listeners
        world.events.removeListener(eid, ecs.physics.COLLISION_START_EVENT, handleCollisionStart)
        world.events.removeListener(eid, ecs.physics.COLLISION_END_EVENT, handleCollisionEnd)
        world.events.removeListener(world.events.globalId, 'vehicle-controller-changed', handleVehicleChange)
      })

    dataAttribute.set(eid, {
      isGrounded: false,
      collisionCount: 0,
      lastPositionX: 0,
      lastPositionY: 0,
      lastPositionZ: 0,
      velocityX: 0,
      velocityZ: 0,
      isActive: true,
    })
  },
  tick: (world, component) => {
    const {eid} = component
    const schema = ballController.get(world, eid)
    const {data} = component

    // Check if this controller is active
    if (!data.isActive) {
      // Ball controller is not active, skip processing
      return
    }

    // Get current position
    const currentPos = world.transform.getWorldPosition(eid)

    // Calculate velocity based on position changes
    const deltaX = currentPos.x - data.lastPositionX
    const deltaZ = currentPos.z - data.lastPositionZ

    // Calculate velocity (skip first frame to avoid large initial values)
    const isFirstFrame = (data.lastPositionX === 0 && data.lastPositionY === 0 && data.lastPositionZ === 0)
    if (!isFirstFrame && world.time.delta > 0) {
      // Update velocity with some smoothing to reduce jitter
      const smoothingFactor = 0.7  // Increased smoothing for smoother velocity tracking
      data.velocityX = data.velocityX * smoothingFactor + (deltaX / world.time.delta) * (1 - smoothingFactor)
      data.velocityZ = data.velocityZ * smoothingFactor + (deltaZ / world.time.delta) * (1 - smoothingFactor)
    }

    // Store current position for next frame's velocity calculation
    data.lastPositionX = currentPos.x
    data.lastPositionY = currentPos.y
    data.lastPositionZ = currentPos.z

    // Get camera angle from shared data
    // The custom-orbit-cam component updates this value every frame
    const cameraAngle = ballCameraData.azimuthAngle

    // Calculate camera's forward and right vectors based on current angles
    // The camera looks at the target, so forward is the direction from camera to target
    // Since camera is behind and above, we need to adjust the vectors
    const camForwardX = -Math.sin(cameraAngle)
    const camForwardZ = -Math.cos(cameraAngle)
    const camRightX = Math.cos(cameraAngle)
    const camRightZ = -Math.sin(cameraAngle)

    // Character controller logic - handle ball movement and jumping
    const {isGrounded} = data
    const controlFactor = isGrounded ? 1 : schema.jumpControlFactor

    // Get input actions
    const forwardInput = world.input.getAction('forward')
    const backwardInput = world.input.getAction('backward')
    const leftInput = world.input.getAction('left')
    const rightInput = world.input.getAction('right')
    const modifyInput = world.input.getAction('modify')

    // Calculate effective force (increase when modify action is active)
    const forceMultiplier = modifyInput ? 2.0 : 1.0
    const effectiveForce = schema.force * forceMultiplier

    // Calculate movement forces relative to camera direction
    let moveX = 0
    let moveZ = 0

    if (forwardInput) {
      moveX += camForwardX * effectiveForce
      moveZ += camForwardZ * effectiveForce
    }
    if (backwardInput) {
      moveX -= camForwardX * effectiveForce
      moveZ -= camForwardZ * effectiveForce
    }
    if (leftInput) {
      moveX -= camRightX * effectiveForce
      moveZ -= camRightZ * effectiveForce
    }
    if (rightInput) {
      moveX += camRightX * effectiveForce
      moveZ += camRightZ * effectiveForce
    }

    // Apply movement with control factor (reduced control in air)
    if (moveX !== 0 || moveZ !== 0) {
      // Normalize movement vector
      const moveMagnitude = Math.sqrt(moveX * moveX + moveZ * moveZ)
      if (moveMagnitude > 0) {
        moveX = (moveX / moveMagnitude) * effectiveForce * controlFactor
        moveZ = (moveZ / moveMagnitude) * effectiveForce * controlFactor
      }

      // Apply force to ball
      ecs.physics.applyForce(world, eid, moveX, 0, moveZ)

      // Apply torque when modifier is enabled
      if (modifyInput && moveMagnitude > 0) {
        // Calculate torque perpendicular to movement direction (right-hand rule)
        // For forward/backward movement, torque around X-axis
        // For left/right movement, torque around Z-axis
        const normalizedMoveX = moveX / moveMagnitude
        const normalizedMoveZ = moveZ / moveMagnitude

        // Torque direction: cross product of movement direction with up vector (0,1,0)
        // Movement = (normalizedMoveX, 0, normalizedMoveZ), Up = (0, 1, 0)
        // Cross product = (normalizedMoveZ, 0, -normalizedMoveX)
        const torqueX = normalizedMoveZ * schema.torqueForce * controlFactor
        const torqueZ = -normalizedMoveX * schema.torqueForce * controlFactor

        ecs.physics.applyTorque(world, eid, torqueX, 0, torqueZ)
      }

      // Enhanced debug logging
      const angleDegrees = (cameraAngle * 180 / Math.PI).toFixed(1)
    }

    // Handle jumping
    if (world.input.getAction('jump') && isGrounded) {
      ecs.physics.applyImpulse(world, eid, 0, schema.jumpForce, 0)
      // Reset grounded state on jump
      data.collisionCount = 0
      data.isGrounded = false
    }
  },
})

export {ballController, ballCameraData}
